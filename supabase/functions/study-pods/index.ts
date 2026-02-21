import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiFetch } from "../_shared/aiFetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, pod_id, message } = await req.json();

    // ACTION: AI Match & Create Pods
    if (action === "ai_match") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("AI not configured");

      // Get user's cognitive profile and weak topics
      const [profileRes, weakRes, existingRes] = await Promise.all([
        adminClient.from("cognitive_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        adminClient.from("memory_scores")
          .select("topic_id, score, topics:topics(name, subject_id, subjects:subjects(name))")
          .eq("user_id", user.id).lt("score", 60).order("score", { ascending: true }).limit(10),
        adminClient.from("study_pod_members").select("pod_id").eq("user_id", user.id),
      ]);

      const profile = profileRes.data;
      const weakTopics = (weakRes.data || []).map((t: any) => ({
        name: t.topics?.name,
        subject: t.topics?.subjects?.name,
        score: t.score,
      })).filter((t: any) => t.name);

      const existingPodIds = (existingRes.data || []).map((m: any) => m.pod_id);

      // Find pods that match this user's profile
      const { data: allPods } = await adminClient.from("study_pods")
        .select("*, study_pod_members(count)")
        .eq("is_active", true);

      const availablePods = (allPods || []).filter((p: any) => {
        if (existingPodIds.includes(p.id)) return false;
        const memberCount = p.study_pod_members?.[0]?.count || 0;
        if (memberCount >= p.max_members) return false;
        return true;
      });

      // Score pods by relevance
      const scored = availablePods.map((pod: any) => {
        let score = 0;
        const criteria = pod.ai_matching_criteria || {};
        
        // Match by subject
        if (pod.subject && weakTopics.some((w: any) => w.subject?.toLowerCase() === pod.subject?.toLowerCase())) {
          score += 40;
        }
        
        // Match by exam type
        if (pod.exam_type && profile?.learning_style) score += 10;
        
        // Match by difficulty
        if (pod.difficulty_level === "mixed") score += 15;
        
        // Boost newer pods
        const ageHours = (Date.now() - new Date(pod.created_at).getTime()) / 3600000;
        if (ageHours < 48) score += 20;
        
        return { ...pod, match_score: score, member_count: pod.study_pod_members?.[0]?.count || 0 };
      });

      scored.sort((a: any, b: any) => b.match_score - a.match_score);

      // If no good matches, create a new AI pod
      if (scored.length === 0 || scored[0].match_score < 20) {
        const topSubject = weakTopics[0]?.subject || "General";
        const topTopics = weakTopics.slice(0, 3).map((t: any) => t.name).join(", ");

        const response = await aiFetch({
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "Generate a study pod name and description for competitive exam students. Return JSON with 'name' and 'description' fields. Keep it motivational and specific. Max 50 words for description." },
              { role: "user", content: `Create a study pod for ${topSubject} focusing on: ${topTopics || "general improvement"}` },
            ],
            tools: [{
              type: "function",
              function: {
                name: "create_pod",
                description: "Create a new study pod",
                parameters: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Pod name, 3-6 words" },
                    description: { type: "string", description: "Pod description, max 50 words" },
                  },
                  required: ["name", "description"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "create_pod" } },
            temperature: 0.7,
          }),
        });

        let podName = `${topSubject} Study Pod`;
        let podDesc = `A focused study group for ${topTopics || topSubject}`;

        if (response.ok) {
          try {
            const aiData = await response.json();
            const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall) {
              const parsed = JSON.parse(toolCall.function.arguments);
              podName = parsed.name || podName;
              podDesc = parsed.description || podDesc;
            }
          } catch {}
        }

        const { data: newPod } = await adminClient.from("study_pods").insert({
          name: podName,
          description: podDesc,
          subject: topSubject,
          is_ai_created: true,
          created_by: user.id,
          ai_matching_criteria: { weak_topics: weakTopics.map((t: any) => t.name), learning_style: profile?.learning_style },
        }).select().single();

        if (newPod) {
          await adminClient.from("study_pod_members").insert({ pod_id: newPod.id, user_id: user.id, role: "creator" });
          return new Response(JSON.stringify({ pod: { ...newPod, member_count: 1, match_score: 100 }, created: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ pods: scored.slice(0, 5), weak_topics: weakTopics.map((t: any) => t.name) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: Join a pod
    if (action === "join" && pod_id) {
      const { error } = await supabase.from("study_pod_members").insert({ pod_id, user_id: user.id });
      if (error && error.code === "23505") {
        return new Response(JSON.stringify({ error: "Already a member" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: Leave a pod
    if (action === "leave" && pod_id) {
      await supabase.from("study_pod_members").delete().eq("pod_id", pod_id).eq("user_id", user.id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: Send message in pod
    if (action === "send_message" && pod_id && message) {
      const { error } = await supabase.from("study_pod_messages").insert({
        pod_id, user_id: user.id, content: message,
      });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: Get my pods
    if (action === "my_pods") {
      const { data: memberships } = await supabase.from("study_pod_members")
        .select("pod_id, role, joined_at, study_pods(*)")
        .eq("user_id", user.id);

      const pods = await Promise.all((memberships || []).map(async (m: any) => {
        const { count } = await adminClient.from("study_pod_members")
          .select("*", { count: "exact", head: true }).eq("pod_id", m.pod_id);
        const { data: lastMsg } = await adminClient.from("study_pod_messages")
          .select("content, created_at").eq("pod_id", m.pod_id)
          .order("created_at", { ascending: false }).limit(1);
        return {
          ...m.study_pods,
          my_role: m.role,
          joined_at: m.joined_at,
          member_count: count || 0,
          last_message: lastMsg?.[0] || null,
        };
      }));

      return new Response(JSON.stringify({ pods }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: Get pod messages
    if (action === "get_messages" && pod_id) {
      const { data } = await supabase.from("study_pod_messages")
        .select("*").eq("pod_id", pod_id)
        .order("created_at", { ascending: true }).limit(100);
      return new Response(JSON.stringify({ messages: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: Admin - list all pods
    if (action === "admin_list") {
      const isAdmin = await adminClient.rpc("is_admin", { _user_id: user.id });
      if (!isAdmin.data) throw new Error("Unauthorized");

      const { data: pods } = await adminClient.from("study_pods")
        .select("*, study_pod_members(count)")
        .order("created_at", { ascending: false });

      const result = (pods || []).map((p: any) => ({
        ...p,
        member_count: p.study_pod_members?.[0]?.count || 0,
      }));

      return new Response(JSON.stringify({ pods: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: Admin - toggle pod active status
    if (action === "admin_toggle" && pod_id) {
      const isAdmin = await adminClient.rpc("is_admin", { _user_id: user.id });
      if (!isAdmin.data) throw new Error("Unauthorized");

      const { data: pod } = await adminClient.from("study_pods").select("is_active").eq("id", pod_id).single();
      await adminClient.from("study_pods").update({ is_active: !pod?.is_active }).eq("id", pod_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (e) {
    console.error("study-pods error:", e);
    const status = (e instanceof Error && e.message === "Unauthorized") ? 401 : 400;
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
