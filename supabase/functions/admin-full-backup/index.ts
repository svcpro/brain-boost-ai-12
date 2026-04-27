// Server-side full / incremental database backup engine.
// - Uses service role to bypass RLS so admin tables export cleanly.
// - Streams pages of 1000 rows per table with up to 4 tables in parallel.
// - Incremental mode: only exports rows where updated_at/created_at > last_run cutoff.
// - Uploads JSON or NDJSON to Storage and returns a 24h signed URL.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Tables we never want to back up (system / internal noise)
const EXCLUDED_TABLES = new Set<string>([
  // Add any internal-only or huge log tables here if desired.
]);

// Discover real public tables at runtime via information_schema RPC fallback.
// We avoid hardcoded lists so new tables are automatically included and
// dropped/renamed tables never cause "relation does not exist" failures.
async function listPublicTables(sb: any): Promise<string[]> {
  // Try a direct query via PostgREST: information_schema is exposed as a system view,
  // but PostgREST doesn't expose it. Instead, use a tiny RPC if present, otherwise
  // probe a known catalog through a SQL function. Falls back to a safe default list.
  try {
    const { data, error } = await sb.rpc("admin_list_public_tables");
    if (!error && Array.isArray(data) && data.length > 0) {
      return data
        .map((r: any) => (typeof r === "string" ? r : r.table_name))
        .filter((t: string) => t && !EXCLUDED_TABLES.has(t))
        .sort();
    }
  } catch (_) { /* fall through */ }
  // Fallback: query pg_catalog through a generic select on a view we expose.
  // If that also fails, the function will return an empty list and the caller
  // will surface a clear error instead of silently backing up nothing.
  return [];
}

const PAGE_SIZE = 1000;
const PARALLEL = 4;

// Try common timestamp columns in priority order
const INCR_COLUMNS = ["updated_at", "created_at", "inserted_at", "started_at"];

async function fetchTable(sb: any, table: string, sinceCol: string | null, sinceIso: string | null) {
  const rows: any[] = [];
  let page = 0;
  while (true) {
    let q = sb.from(table).select("*").range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (sinceCol && sinceIso) q = q.gt(sinceCol, sinceIso);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  return rows;
}

// Detect which timestamp column a table actually has by probing 1 row
async function detectTimestampColumn(sb: any, table: string): Promise<string | null> {
  const { data, error } = await sb.from(table).select("*").limit(1);
  if (error || !data || data.length === 0) return null;
  const sample = data[0];
  for (const col of INCR_COLUMNS) {
    if (col in sample && sample[col] != null) return col;
    if (col in sample) return col; // accept even if null in sample
  }
  return null;
}

// ---- CSV + minimal store-only ZIP helpers ----
function csvEscape(v: any): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (typeof v === "object") {
    try { s = JSON.stringify(v); } catch { s = String(v); }
  } else {
    s = String(v);
  }
  // Quote if contains special chars
  if (/[",\r\n]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function rowsToCsv(rows: any[]): string {
  if (!rows || rows.length === 0) return "";
  // Union of all keys (some rows may have nulls / missing keys)
  const keySet = new Set<string>();
  for (const r of rows) {
    if (r && typeof r === "object") {
      for (const k of Object.keys(r)) keySet.add(k);
    }
  }
  const keys = Array.from(keySet);
  const lines: string[] = [];
  lines.push(keys.map(csvEscape).join(","));
  for (const r of rows) {
    lines.push(keys.map((k) => csvEscape(r?.[k])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

// CRC32 (used by ZIP)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// Build a store-only ZIP archive from {name, data} entries
function buildZip(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const dosTime = 0, dosDate = 0x21; // 1980-01-01

  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const crc = crc32(e.data);
    const size = e.data.length;

    // Local file header
    const lfh = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(lfh.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);            // version
    dv.setUint16(6, 0, true);             // flags
    dv.setUint16(8, 0, true);             // method = store
    dv.setUint16(10, dosTime, true);
    dv.setUint16(12, dosDate, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, size, true);
    dv.setUint32(22, size, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);
    lfh.set(nameBytes, 30);
    chunks.push(lfh);
    chunks.push(e.data);

    // Central directory header
    const cdh = new Uint8Array(46 + nameBytes.length);
    const cdv = new DataView(cdh.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);
    cdv.setUint16(6, 20, true);
    cdv.setUint16(8, 0, true);
    cdv.setUint16(10, 0, true);
    cdv.setUint16(12, dosTime, true);
    cdv.setUint16(14, dosDate, true);
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, size, true);
    cdv.setUint32(24, size, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint16(30, 0, true);
    cdv.setUint16(32, 0, true);
    cdv.setUint16(34, 0, true);
    cdv.setUint16(36, 0, true);
    cdv.setUint32(38, 0, true);
    cdv.setUint32(42, offset, true);
    cdh.set(nameBytes, 46);
    central.push(cdh);

    offset += lfh.length + e.data.length;
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const centralOffset = offset;
  for (const c of central) { chunks.push(c); offset += c.length; }

  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true);
  edv.setUint16(4, 0, true);
  edv.setUint16(6, 0, true);
  edv.setUint16(8, entries.length, true);
  edv.setUint16(10, entries.length, true);
  edv.setUint32(12, centralSize, true);
  edv.setUint32(16, centralOffset, true);
  edv.setUint16(20, 0, true);
  chunks.push(eocd);

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "missing_token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: isAdmin } = await sb.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "start";

    if (action === "list_tables") {
      const tables = await listPublicTables(sb);
      return new Response(JSON.stringify({ tables }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Return last successful run timestamp (for UI preview of "since")
    if (action === "last_run") {
      const { data: last } = await sb.from("admin_backup_runs")
        .select("id, finished_at, mode, total_rows, size_bytes")
        .eq("status", "completed")
        .order("finished_at", { ascending: false })
        .limit(1).maybeSingle();
      return new Response(JSON.stringify({ last }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const format: "json" | "ndjson" | "csv" =
      body.format === "ndjson" ? "ndjson" : body.format === "csv" ? "csv" : "json";
    const mode: "full" | "incremental" = body.mode === "incremental" ? "incremental" : "full";

    // Always discover the live table list so backups stay accurate as the schema evolves.
    const liveTables = await listPublicTables(sb);
    if (liveTables.length === 0) {
      return new Response(JSON.stringify({ error: "no_tables_discovered. Ensure admin_list_public_tables() exists and is granted." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const requested: string[] = Array.isArray(body.tables) && body.tables.length
      ? body.tables.filter((t: string) => liveTables.includes(t))
      : liveTables;

    // Resolve incremental cutoff: explicit `since` or last completed run
    let sinceIso: string | null = null;
    if (mode === "incremental") {
      if (body.since) {
        sinceIso = new Date(body.since).toISOString();
      } else {
        const { data: last } = await sb.from("admin_backup_runs")
          .select("finished_at").eq("status", "completed")
          .order("finished_at", { ascending: false }).limit(1).maybeSingle();
        if (last?.finished_at) sinceIso = last.finished_at;
      }
      // No prior run → fall back to a full export, but record as incremental for first baseline
      if (!sinceIso) {
        sinceIso = new Date(0).toISOString(); // epoch = effectively full
      }
    }

    const startedAt = Date.now();
    const { data: runRow, error: runErr } = await sb.from("admin_backup_runs").insert({
      triggered_by: user.id,
      status: "running",
      format,
      mode,
      since_timestamp: sinceIso,
      scope: requested.length === liveTables.length ? "full" : "partial",
      selected_tables: requested.length === liveTables.length ? null : requested,
      total_tables: requested.length,
    }).select().single();
    if (runErr) throw runErr;
    const runId = runRow.id;

    const results: Record<string, { count: number; data?: any[]; error?: string; sinceCol?: string | null }> = {};
    const failed: string[] = [];
    const skipped: string[] = []; // incremental: tables w/ 0 changes
    let totalRows = 0;
    let completed = 0;

    let cursor = 0;
    async function worker() {
      while (cursor < requested.length) {
        const idx = cursor++;
        const table = requested[idx];
        try {
          let sinceCol: string | null = null;
          if (mode === "incremental") {
            sinceCol = await detectTimestampColumn(sb, table);
            // If no timestamp column, include the whole table (safer than dropping data)
          }
          const rows = await fetchTable(sb, table, sinceCol, sinceCol ? sinceIso : null);
          results[table] = { count: rows.length, data: rows, sinceCol };
          totalRows += rows.length;
          if (mode === "incremental" && rows.length === 0) skipped.push(table);
        } catch (e: any) {
          results[table] = { count: 0, data: [], error: e.message };
          failed.push(table);
        }
        completed++;
        if (completed % 8 === 0 || completed === requested.length) {
          await sb.from("admin_backup_runs")
            .update({ completed_tables: completed, failed_tables: failed, total_rows: totalRows, skipped_tables: skipped })
            .eq("id", runId);
        }
      }
    }
    await Promise.all(Array.from({ length: PARALLEL }, worker));

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    let blob: Uint8Array;
    let ext: string;
    let contentType: string;

    const metaCommon = {
      exportedAt: new Date().toISOString(),
      version: "3.1",
      mode,
      since: sinceIso,
      totalTables: requested.length,
      successfulTables: requested.length - failed.length,
      skippedTables: skipped,
      failedTables: failed,
      totalRows,
    };

    if (format === "ndjson") {
      const enc = new TextEncoder();
      const chunks: Uint8Array[] = [];
      chunks.push(enc.encode(JSON.stringify({ _meta: { ...metaCommon, format: "ndjson" } }) + "\n"));
      for (const t of requested) {
        const r = results[t];
        if (!r?.data?.length) continue;
        for (const row of r.data) {
          chunks.push(enc.encode(JSON.stringify({ _table: t, row }) + "\n"));
        }
      }
      const total = chunks.reduce((s, c) => s + c.length, 0);
      blob = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { blob.set(c, off); off += c.length; }
      ext = "ndjson";
      contentType = "application/x-ndjson";
    } else if (format === "csv") {
      // One CSV per table, packaged as a ZIP archive (store-only).
      const enc = new TextEncoder();
      const entries: { name: string; data: Uint8Array }[] = [];
      // Add a manifest with metadata + per-table summary
      const manifest = {
        ...metaCommon,
        format: "csv",
        type: mode === "incremental" ? "incremental_backup" : "full_database_backup",
        tables: Object.fromEntries(
          requested.map((t) => [t, {
            count: results[t]?.count ?? 0,
            error: results[t]?.error ?? null,
            sinceCol: results[t]?.sinceCol ?? null,
          }])
        ),
      };
      entries.push({ name: "_manifest.json", data: enc.encode(JSON.stringify(manifest, null, 2)) });
      // README explaining the file format (Windows shows CSV as "XLS Worksheet" when Excel is the default app)
      const readme = [
        "ACRY Database Backup — CSV Format",
        "===================================",
        "",
        "All data files in this archive are TRUE CSV files (.csv extension).",
        "",
        "Why does Windows show them as 'XLS Worksheet'?",
        "  Windows displays the *default application* in the Type column.",
        "  Because Excel is set as the default app for .csv on your PC,",
        "  Windows labels them 'XLS Worksheet' — but the file extension",
        "  is genuinely .csv (plain comma-separated text).",
        "",
        "To verify:",
        "  1. Enable: View → Show → File name extensions in File Explorer",
        "  2. Or right-click any file → Properties → 'Type of file: CSV File (.csv)'",
        "  3. Or open with Notepad — you'll see plain comma-separated text",
        "",
        "Encoding: UTF-8 with BOM (renders ₹, emoji, accents correctly in Excel)",
        "Delimiter: Comma (,)",
        "Line ending: CRLF (\\r\\n)",
        "Quoting: Fields with commas/quotes/newlines are wrapped in double quotes",
        "",
        `Generated: ${new Date().toISOString()}`,
        `Mode: ${mode}`,
        `Tables: ${requested.length}`,
      ].join("\r\n");
      entries.push({ name: "README.txt", data: enc.encode(readme) });
      // UTF-8 BOM so Excel/Google Sheets render Unicode characters (₹, emoji, accents) correctly
      const BOM = new Uint8Array([0xEF, 0xBB, 0xBF]);
      for (const t of requested) {
        const r = results[t];
        const csv = rowsToCsv(r?.data ?? []);
        const csvBytes = enc.encode(csv);
        const withBom = new Uint8Array(BOM.length + csvBytes.length);
        withBom.set(BOM, 0);
        withBom.set(csvBytes, BOM.length);
        // Always include a CSV file (header-only if empty) for completeness
        entries.push({ name: `${t}.csv`, data: withBom });
      }
      blob = buildZip(entries);
      ext = "zip";
      contentType = "application/zip";
    } else {
      const payload = {
        _meta: { ...metaCommon, format: "json", type: mode === "incremental" ? "incremental_backup" : "full_database_backup" },
        tables: results,
      };
      blob = new TextEncoder().encode(JSON.stringify(payload));
      ext = "json";
      contentType = "application/json";
    }

    const prefix = mode === "incremental" ? "acry-incr" : "acry-backup";
    const path = `${user.id}/${prefix}-${ts}.${ext}`;
    const { error: upErr } = await sb.storage.from("admin-backups")
      .upload(path, blob, { contentType, upsert: true });
    if (upErr) throw upErr;

    const { data: signed } = await sb.storage.from("admin-backups")
      .createSignedUrl(path, 60 * 60 * 24);

    const duration = Date.now() - startedAt;
    await sb.from("admin_backup_runs").update({
      status: failed.length === requested.length ? "failed" : "completed",
      completed_tables: completed,
      failed_tables: failed,
      skipped_tables: skipped,
      total_rows: totalRows,
      size_bytes: blob.byteLength,
      storage_path: path,
      download_url: signed?.signedUrl,
      duration_ms: duration,
      finished_at: new Date().toISOString(),
    }).eq("id", runId);

    return new Response(JSON.stringify({
      ok: true,
      run_id: runId,
      mode,
      since: sinceIso,
      status: failed.length === requested.length ? "failed" : "completed",
      total_tables: requested.length,
      completed_tables: completed,
      skipped_tables: skipped,
      failed_tables: failed,
      total_rows: totalRows,
      size_bytes: blob.byteLength,
      duration_ms: duration,
      download_url: signed?.signedUrl,
      storage_path: path,
      format,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("admin-full-backup error:", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
