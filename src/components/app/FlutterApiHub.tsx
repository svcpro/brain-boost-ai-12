import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Copy, Send, CheckCircle2, XCircle, ChevronDown, ChevronRight,
  Code, BookOpen, Play, Smartphone, Shield, Zap, Globe, Lock, Search,
  Download, FileJson, Terminal, Eye, EyeOff, AlertTriangle, Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// ─── ACRY API Route Map ───
const ACRY_API_ROUTES = [
  // Auth
  { group: "Authentication", path: "auth/login", method: "POST", desc: "Login user with email & password", auth: false, request: { email: "string", password: "string" }, response: { token: "JWT_TOKEN", user: { id: "string", email: "string" } } },
  { group: "Authentication", path: "auth/signup", method: "POST", desc: "Register new user", auth: false, request: { email: "string", password: "string", display_name: "string" }, response: { token: "JWT_TOKEN", user: { id: "string", email: "string" } } },
  { group: "Authentication", path: "auth/logout", method: "POST", desc: "Invalidate current session", auth: true, request: {}, response: { success: true } },
  { group: "Authentication", path: "auth/refresh-token", method: "POST", desc: "Refresh expired JWT token", auth: true, request: { refresh_token: "string" }, response: { token: "NEW_JWT_TOKEN", expires_in: 3600 } },
  // User
  { group: "User", path: "user/profile", method: "GET", desc: "Get current user profile", auth: true, request: {}, response: { id: "string", display_name: "string", email: "string", avatar_url: "string", exam_type: "string", exam_date: "string", daily_study_goal_minutes: 30 } },
  { group: "User", path: "user/profile", method: "PUT", desc: "Update user profile", auth: true, request: { display_name: "string", exam_type: "string", exam_date: "string" }, response: { success: true, data: { id: "string", display_name: "string" } } },
  { group: "User", path: "user/preferences", method: "GET", desc: "Get user study preferences", auth: true, request: {}, response: { daily_goal: 30, weekly_goal: 300, email_reminders: true, push_notifications: true } },
  { group: "User", path: "user/preferences", method: "PUT", desc: "Update study preferences", auth: true, request: { daily_study_goal_minutes: 30, email_study_reminders: true }, response: { success: true } },
  // Brain
  { group: "Brain", path: "brain/memory-status", method: "GET", desc: "Get memory strength for all topics", auth: true, request: {}, response: { topics: [{ topic_id: "string", name: "string", memory_strength: 72, forget_risk: 28, next_review: "ISO_DATE" }] } },
  { group: "Brain", path: "brain/predict-rank", method: "GET", desc: "Get AI rank prediction", auth: true, request: {}, response: { predicted_rank: 85, confidence: 0.78, trend: "improving" } },
  { group: "Brain", path: "brain/get-daily-plan", method: "GET", desc: "Get AI-generated daily study plan", auth: true, request: {}, response: { sessions: [{ topic: "string", duration_minutes: 25, mode: "review", reason: "string" }] } },
  { group: "Brain", path: "brain/evolution", method: "GET", desc: "Get brain evolution score & timeline", auth: true, request: {}, response: { evolution_score: 72, learning_speed: 0.8, decay_rate: 0.3, optimal_hour: 9 } },
  { group: "Brain", path: "brain/cognitive-twin", method: "GET", desc: "Get cognitive twin profile", auth: true, request: {}, response: { recall_pattern: "visual", optimal_session: 25, fatigue_threshold: 90, efficiency_score: 0.82 } },
  // Action
  { group: "Action", path: "action/log-study", method: "POST", desc: "Log a completed study session", auth: true, request: { topic_id: "string", duration_minutes: 25, confidence_level: 4, study_mode: "review" }, response: { success: true, streak_updated: true, new_memory_score: 78 } },
  { group: "Action", path: "action/start-fix", method: "POST", desc: "Start a fix/review session for weak topics", auth: true, request: { topic_id: "string" }, response: { session_id: "string", questions: [] } },
  { group: "Action", path: "action/submit-recall", method: "POST", desc: "Submit recall answer for a topic", auth: true, request: { topic_id: "string", confidence: 4, correct: true }, response: { success: true, new_score: 85, next_review: "ISO_DATE" } },
  // AI Agent
  { group: "AI Agent", path: "ai/recommendations", method: "GET", desc: "Get AI study recommendations", auth: true, request: {}, response: { recommendations: [{ title: "string", description: "string", priority: "high", type: "review" }] } },
  { group: "AI Agent", path: "ai/next-best-topic", method: "GET", desc: "Get next best topic to study", auth: true, request: {}, response: { topic_id: "string", topic_name: "string", reason: "string", duration: 25 } },
  { group: "AI Agent", path: "ai/strategy-plan", method: "GET", desc: "Get personalized strategy plan", auth: true, request: {}, response: { plan: { focus_areas: [], schedule: {}, intensity: "medium" } } },
  // Chat
  { group: "Chat Support", path: "chat/send-message", method: "POST", desc: "Send message to AI support chat", auth: true, request: { message: "string", language: "en" }, response: { reply: "string", suggestions: [] } },
  { group: "Chat Support", path: "chat/history", method: "GET", desc: "Get chat conversation history", auth: true, request: {}, response: { messages: [{ role: "user", content: "string", created_at: "ISO_DATE" }] } },
  { group: "Chat Support", path: "chat/voice-support", method: "POST", desc: "Send voice message for AI support", auth: true, request: { audio_base64: "string", language: "en" }, response: { transcript: "string", reply: "string" } },
  // Subscription
  { group: "Subscription", path: "subscription/plans", method: "GET", desc: "Get available subscription plans", auth: false, request: {}, response: { plans: [{ id: "string", name: "Pro", price: 299, features: [] }] } },
  { group: "Subscription", path: "subscription/subscribe", method: "POST", desc: "Subscribe to a plan", auth: true, request: { plan_id: "string", payment_method: "razorpay" }, response: { order_id: "string", status: "pending" } },
  { group: "Subscription", path: "subscription/status", method: "GET", desc: "Get current subscription status", auth: true, request: {}, response: { plan: "pro", status: "active", expires_at: "ISO_DATE" } },
  // Admin
  { group: "Admin", path: "admin/generate-api-key", method: "POST", desc: "Generate new API key", auth: true, request: { name: "string", environment: "production", permissions: [] }, response: { api_key: "acry_...", key_id: "string" } },
  { group: "Admin", path: "admin/users", method: "GET", desc: "List all users (admin only)", auth: true, request: {}, response: { users: [], total: 0, page: 1 } },
  { group: "Admin", path: "admin/system-health", method: "GET", desc: "Get system health metrics", auth: true, request: {}, response: { uptime: "99.9%", avg_latency: 120, active_users: 1500 } },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-400",
  POST: "bg-blue-500/15 text-blue-400",
  PUT: "bg-amber-500/15 text-amber-400",
  DELETE: "bg-red-500/15 text-red-400",
};

const FlutterApiHub = () => {
  const [activeSection, setActiveSection] = useState<"overview" | "routes" | "examples" | "tester" | "errors">("overview");

  return (
    <div className="space-y-4 mt-4">
      {/* Section Nav */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { key: "overview" as const, label: "Quick Start", icon: Zap },
          { key: "routes" as const, label: "API Routes", icon: Globe },
          { key: "examples" as const, label: "Flutter Examples", icon: Smartphone },
          { key: "tester" as const, label: "API Tester", icon: Terminal },
          { key: "errors" as const, label: "Error Codes", icon: AlertTriangle },
        ].map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activeSection === s.key ? "bg-primary text-primary-foreground" : "bg-secondary/70 text-muted-foreground hover:text-foreground"}`}>
            <s.icon className="w-3.5 h-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeSection} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          {activeSection === "overview" && <QuickStartSection />}
          {activeSection === "routes" && <RoutesSection />}
          {activeSection === "examples" && <FlutterExamplesSection />}
          {activeSection === "tester" && <ApiTesterSection />}
          {activeSection === "errors" && <ErrorCodesSection />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ─── Quick Start ───
const QuickStartSection = () => {
  const { toast } = useToast();
  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
  const copy = (text: string) => { navigator.clipboard.writeText(text); toast({ title: "Copied!" }); };

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-5 neural-border">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
          <Smartphone className="w-4 h-4 text-primary" /> Flutter Quick Start Guide
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Everything your Flutter team needs to integrate ACRY APIs in minutes.</p>

        {/* Architecture */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          {[
            { title: "Base URL", value: baseUrl, sub: "All endpoints relative to this" },
            { title: "Auth Method", value: "Bearer JWT", sub: "Authorization: Bearer <token>" },
            { title: "Content Type", value: "application/json", sub: "All request & response bodies" },
          ].map(item => (
            <div key={item.title} className="bg-secondary/50 rounded-lg p-3">
              <span className="text-[10px] text-muted-foreground">{item.title}</span>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs font-mono text-foreground truncate flex-1">{item.value}</code>
                <button onClick={() => copy(item.value)} className="p-0.5 hover:bg-secondary rounded">
                  <Copy className="w-3 h-3 text-primary" />
                </button>
              </div>
              <p className="text-[9px] text-muted-foreground mt-1">{item.sub}</p>
            </div>
          ))}
        </div>

        {/* Standard Response Format */}
        <div className="mb-5">
          <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <FileJson className="w-3.5 h-3.5 text-accent" /> Standard Response Format
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-success font-medium mb-1 block">✓ Success Response</span>
              <pre className="text-[10px] bg-secondary rounded-lg p-3 font-mono text-foreground overflow-x-auto">{`{
  "success": true,
  "message": "Memory prediction successful",
  "data": {
    "memory_strength": 72,
    "forget_risk": 28
  }
}`}</pre>
            </div>
            <div>
              <span className="text-[10px] text-destructive font-medium mb-1 block">✗ Error Response</span>
              <pre className="text-[10px] bg-secondary rounded-lg p-3 font-mono text-foreground overflow-x-auto">{`{
  "success": false,
  "message": "Invalid API key",
  "error_code": 401
}`}</pre>
            </div>
          </div>
        </div>

        {/* Flutter Setup */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Code className="w-3.5 h-3.5 text-primary" /> Step 1: Add Dependencies (pubspec.yaml)
          </h4>
          <CodeBlock code={`dependencies:
  http: ^1.2.0
  flutter_secure_storage: ^9.0.0`} lang="yaml" />
        </div>

        <div className="mb-4">
          <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Code className="w-3.5 h-3.5 text-primary" /> Step 2: Create API Client (lib/api/acry_client.dart)
          </h4>
          <CodeBlock code={`import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AcryApi {
  static const String baseUrl = '${baseUrl}';
  static const String anonKey = '${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}';
  final _storage = const FlutterSecureStorage();

  Future<Map<String, String>> _headers({bool auth = true}) async {
    final headers = {
      'Content-Type': 'application/json',
      'apikey': anonKey,
    };
    if (auth) {
      final token = await _storage.read(key: 'jwt_token');
      if (token != null) headers['Authorization'] = 'Bearer \$token';
    }
    return headers;
  }

  Future<Map<String, dynamic>> get(String path, {bool auth = true}) async {
    final res = await http.get(
      Uri.parse('\$baseUrl/\$path'),
      headers: await _headers(auth: auth),
    );
    return _handleResponse(res);
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body, {bool auth = true}) async {
    final res = await http.post(
      Uri.parse('\$baseUrl/\$path'),
      headers: await _headers(auth: auth),
      body: jsonEncode(body),
    );
    return _handleResponse(res);
  }

  Map<String, dynamic> _handleResponse(http.Response res) {
    final data = jsonDecode(res.body);
    if (res.statusCode >= 400) {
      throw AcryApiException(
        message: data['message'] ?? 'Unknown error',
        code: data['error_code'] ?? res.statusCode,
      );
    }
    return data;
  }
}

class AcryApiException implements Exception {
  final String message;
  final int code;
  AcryApiException({required this.message, required this.code});
  @override
  String toString() => 'AcryApiException(\$code): \$message';
}`} lang="dart" />
        </div>

        <div>
          <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Code className="w-3.5 h-3.5 text-primary" /> Step 3: Auth Flow (Login → Store Token)
          </h4>
          <CodeBlock code={`final api = AcryApi();

// Login
final result = await api.post('auth/login', {
  'email': 'user@example.com',
  'password': 'password123',
}, auth: false);

// Store JWT token
await FlutterSecureStorage().write(
  key: 'jwt_token',
  value: result['token'],
);

// Now all authenticated calls work automatically
final profile = await api.get('user/profile');
print(profile['data']['display_name']);`} lang="dart" />
        </div>
      </div>

      {/* API Coverage Summary */}
      <div className="glass rounded-xl p-4 neural-border">
        <h4 className="text-xs font-semibold text-foreground mb-3">API Coverage Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(ACRY_API_ROUTES.reduce((acc, r) => {
            acc[r.group] = (acc[r.group] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)).map(([group, count]) => (
            <div key={group} className="bg-secondary/50 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-foreground">{count}</p>
              <p className="text-[10px] text-muted-foreground">{group}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Routes Section ───
const RoutesSection = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);
  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

  const groups = ACRY_API_ROUTES.reduce((acc, route) => {
    if (!acc[route.group]) acc[route.group] = [];
    acc[route.group].push(route);
    return acc;
  }, {} as Record<string, typeof ACRY_API_ROUTES>);

  const filteredGroups = search
    ? Object.fromEntries(Object.entries(groups).map(([g, routes]) => [g, routes.filter(r => r.path.includes(search) || r.desc.toLowerCase().includes(search.toLowerCase()))]).filter(([, r]) => (r as any[]).length > 0))
    : groups;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search routes..."
            className="w-full pl-9 pr-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none" />
        </div>
        <span className="text-[10px] text-muted-foreground">{ACRY_API_ROUTES.length} endpoints</span>
      </div>

      {Object.entries(filteredGroups).map(([group, routes]) => (
        <div key={group} className="glass rounded-xl neural-border overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-secondary/30">
            <span className="text-xs font-semibold text-foreground">{group}</span>
            <span className="text-[10px] text-muted-foreground ml-2">({(routes as any[]).length} endpoints)</span>
          </div>
          <div className="divide-y divide-border/50">
            {(routes as typeof ACRY_API_ROUTES).map(route => {
              const key = `${route.method}-${route.path}`;
              const isExpanded = expandedRoute === key;
              return (
                <div key={key}>
                  <button onClick={() => setExpandedRoute(isExpanded ? null : key)}
                    className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-secondary/30 transition-colors text-left">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${METHOD_COLORS[route.method]}`}>{route.method}</span>
                    <code className="text-xs font-mono text-foreground flex-1">/v1/{route.path}</code>
                    <span className="text-[10px] text-muted-foreground hidden md:block">{route.desc}</span>
                    {route.auth && <Lock className="w-3 h-3 text-warning" />}
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden">
                        <div className="px-3 pb-3 space-y-3 border-t border-border/50">
                          <p className="text-[10px] text-muted-foreground mt-2">{route.desc}</p>
                          <div className="grid grid-cols-3 gap-2 text-[10px]">
                            <div><span className="text-muted-foreground block">Auth</span><span className="text-foreground">{route.auth ? "JWT Required" : "Public"}</span></div>
                            <div><span className="text-muted-foreground block">Method</span><span className="text-foreground font-mono">{route.method}</span></div>
                            <div><span className="text-muted-foreground block">URL</span>
                              <button onClick={() => { navigator.clipboard.writeText(`${baseUrl}/${route.path}`); toast({ title: "Copied!" }); }}
                                className="text-primary hover:underline font-mono truncate block">Copy URL</button>
                            </div>
                          </div>
                          {Object.keys(route.request).length > 0 && (
                            <div>
                              <span className="text-[10px] text-muted-foreground block mb-1">Request Body</span>
                              <pre className="text-[10px] bg-secondary rounded-lg p-2 font-mono text-foreground overflow-x-auto">
                                {JSON.stringify(route.request, null, 2)}
                              </pre>
                            </div>
                          )}
                          <div>
                            <span className="text-[10px] text-muted-foreground block mb-1">Response</span>
                            <pre className="text-[10px] bg-secondary rounded-lg p-2 font-mono text-foreground overflow-x-auto">
{`{
  "success": true,
  "message": "OK",
  "data": ${JSON.stringify(route.response, null, 4)}
}`}
                            </pre>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block mb-1">Flutter Example</span>
                            <CodeBlock code={route.method === "GET"
                              ? `final data = await api.get('${route.path}');`
                              : `final data = await api.post('${route.path}', ${JSON.stringify(route.request, null, 2)});`} lang="dart" />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Flutter Examples ───
const FlutterExamplesSection = () => {
  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
  const examples = [
    {
      title: "Complete Login Flow",
      desc: "Authenticate user, store token, handle errors",
      code: `import 'package:acry/api/acry_client.dart';

class AuthService {
  final _api = AcryApi();

  Future<bool> login(String email, String password) async {
    try {
      final result = await _api.post('auth/login', {
        'email': email,
        'password': password,
      }, auth: false);

      if (result['success'] == true) {
        await FlutterSecureStorage().write(
          key: 'jwt_token',
          value: result['data']['token'],
        );
        return true;
      }
      return false;
    } on AcryApiException catch (e) {
      print('Login failed: \${e.message}');
      return false;
    }
  }

  Future<void> logout() async {
    await _api.post('auth/logout', {});
    await FlutterSecureStorage().delete(key: 'jwt_token');
  }
}`,
    },
    {
      title: "Get User Profile",
      desc: "Fetch and display user profile data",
      code: `class ProfileService {
  final _api = AcryApi();

  Future<UserProfile> getProfile() async {
    final result = await _api.get('user/profile');
    return UserProfile.fromJson(result['data']);
  }

  Future<void> updateProfile({
    String? displayName,
    String? examType,
  }) async {
    await _api.post('user/profile', {
      if (displayName != null) 'display_name': displayName,
      if (examType != null) 'exam_type': examType,
    });
  }
}

class UserProfile {
  final String id, displayName, email;
  final String? avatarUrl, examType;

  UserProfile({
    required this.id,
    required this.displayName,
    required this.email,
    this.avatarUrl,
    this.examType,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'],
      displayName: json['display_name'] ?? '',
      email: json['email'] ?? '',
      avatarUrl: json['avatar_url'],
      examType: json['exam_type'],
    );
  }
}`,
    },
    {
      title: "Brain Memory Status",
      desc: "Fetch memory predictions and forget risk",
      code: `class BrainService {
  final _api = AcryApi();

  Future<List<TopicMemory>> getMemoryStatus() async {
    final result = await _api.get('brain/memory-status');
    final topics = result['data']['topics'] as List;
    return topics.map((t) => TopicMemory.fromJson(t)).toList();
  }

  Future<RankPrediction> predictRank() async {
    final result = await _api.get('brain/predict-rank');
    return RankPrediction.fromJson(result['data']);
  }

  Future<DailyPlan> getDailyPlan() async {
    final result = await _api.get('brain/get-daily-plan');
    return DailyPlan.fromJson(result['data']);
  }
}

class TopicMemory {
  final String topicId, name;
  final int memoryStrength, forgetRisk;
  final String nextReview;

  TopicMemory({required this.topicId, required this.name,
    required this.memoryStrength, required this.forgetRisk,
    required this.nextReview});

  factory TopicMemory.fromJson(Map<String, dynamic> json) => TopicMemory(
    topicId: json['topic_id'],
    name: json['name'],
    memoryStrength: json['memory_strength'],
    forgetRisk: json['forget_risk'],
    nextReview: json['next_review'],
  );
}`,
    },
    {
      title: "AI Chat Support",
      desc: "Send messages and get AI responses",
      code: `class ChatService {
  final _api = AcryApi();

  Future<String> sendMessage(String message) async {
    final result = await _api.post('chat/send-message', {
      'message': message,
      'language': 'en',
    });
    return result['data']['reply'];
  }

  Future<List<ChatMessage>> getHistory() async {
    final result = await _api.get('chat/history');
    final messages = result['data']['messages'] as List;
    return messages.map((m) => ChatMessage.fromJson(m)).toList();
  }
}

class ChatMessage {
  final String role, content, createdAt;
  ChatMessage({required this.role, required this.content, required this.createdAt});
  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
    role: json['role'],
    content: json['content'],
    createdAt: json['created_at'],
  );
}`,
    },
    {
      title: "Log Study Session",
      desc: "Track study activity with the action API",
      code: `class StudyLogger {
  final _api = AcryApi();

  Future<StudyResult> logSession({
    required String topicId,
    required int durationMinutes,
    required int confidenceLevel,
    String mode = 'review',
  }) async {
    final result = await _api.post('action/log-study', {
      'topic_id': topicId,
      'duration_minutes': durationMinutes,
      'confidence_level': confidenceLevel,
      'study_mode': mode,
    });
    return StudyResult.fromJson(result['data']);
  }
}

class StudyResult {
  final bool streakUpdated;
  final int newMemoryScore;
  StudyResult({required this.streakUpdated, required this.newMemoryScore});
  factory StudyResult.fromJson(Map<String, dynamic> json) => StudyResult(
    streakUpdated: json['streak_updated'] ?? false,
    newMemoryScore: json['new_memory_score'] ?? 0,
  );
}`,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Smartphone className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Ready-to-Use Flutter (Dart) Examples</h3>
        <span className="text-[10px] text-muted-foreground">Copy & paste into your Flutter project</span>
      </div>
      {examples.map((ex, i) => (
        <motion.div key={ex.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
          className="glass rounded-xl neural-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h4 className="text-xs font-semibold text-foreground">{ex.title}</h4>
            <p className="text-[10px] text-muted-foreground">{ex.desc}</p>
          </div>
          <div className="p-3">
            <CodeBlock code={ex.code} lang="dart" />
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// ─── API Tester ───
const ApiTesterSection = () => {
  const { toast } = useToast();
  const { session } = useAuth();
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("user/profile");
  const [body, setBody] = useState("{}");
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [showToken, setShowToken] = useState(false);

  const execute = async () => {
    setLoading(true);
    setResponse(null);
    const start = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke(path.split("/")[0] === "auth" ? "ai-support-chat" : path.replace(/\//g, "-"), {
        body: method === "GET" ? undefined : JSON.parse(body),
      });
      const elapsed = Date.now() - start;
      setLatency(elapsed);
      if (error) {
        setStatusCode(500);
        setResponse(JSON.stringify({ success: false, message: error.message, error_code: 500 }, null, 2));
      } else {
        setStatusCode(200);
        setResponse(JSON.stringify({ success: true, message: "OK", data }, null, 2));
      }
    } catch (e: any) {
      setLatency(Date.now() - start);
      setStatusCode(500);
      setResponse(JSON.stringify({ success: false, message: e.message, error_code: 500 }, null, 2));
    }
    setLoading(false);
  };

  const presets = ACRY_API_ROUTES.slice(0, 15);

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4 neural-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
          <Terminal className="w-4 h-4 text-primary" /> API Test Console
        </h3>

        {/* Auth Status */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-3 text-xs ${session ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
          {session ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {session ? "Authenticated — requests use your session token" : "Not authenticated — log in to test protected endpoints"}
          {session && (
            <button onClick={() => setShowToken(!showToken)} className="ml-auto p-0.5 hover:bg-secondary rounded">
              {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
          )}
        </div>
        {showToken && session?.access_token && (
          <div className="mb-3">
            <code className="text-[9px] font-mono text-muted-foreground break-all bg-secondary rounded p-2 block">{session.access_token.substring(0, 50)}...</code>
          </div>
        )}

        {/* Quick Presets */}
        <div className="mb-3">
          <span className="text-[10px] text-muted-foreground mb-1.5 block">Quick Presets</span>
          <div className="flex flex-wrap gap-1.5">
            {presets.map(p => (
              <button key={`${p.method}-${p.path}`} onClick={() => { setMethod(p.method); setPath(p.path); setBody(JSON.stringify(p.request, null, 2)); }}
                className="px-2 py-1 bg-secondary/70 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors font-mono">
                <span className={`${METHOD_COLORS[p.method].split(" ")[1]} font-bold mr-1`}>{p.method}</span>
                /{p.path}
              </button>
            ))}
          </div>
        </div>

        {/* Request Builder */}
        <div className="grid grid-cols-[80px_1fr_auto] gap-2 mb-3">
          <select value={method} onChange={e => setMethod(e.target.value)}
            className="px-2 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border outline-none font-mono font-bold">
            <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
          </select>
          <input value={path} onChange={e => setPath(e.target.value)} placeholder="endpoint/path"
            className="px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none font-mono" />
          <button onClick={execute} disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-50">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send
          </button>
        </div>

        {method !== "GET" && (
          <div className="mb-3">
            <span className="text-[10px] text-muted-foreground mb-1 block">Request Body (JSON)</span>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={4}
              className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none font-mono resize-y" />
          </div>
        )}

        {/* Response */}
        {response && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${statusCode && statusCode < 400 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                {statusCode}
              </span>
              {latency !== null && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{latency}ms</span>}
              <button onClick={() => { navigator.clipboard.writeText(response); toast({ title: "Response copied" }); }} className="ml-auto p-1 hover:bg-secondary rounded">
                <Copy className="w-3 h-3 text-primary" />
              </button>
            </div>
            <pre className="text-[10px] bg-secondary rounded-lg p-3 font-mono text-foreground overflow-x-auto max-h-[300px] overflow-y-auto">{response}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Error Codes ───
const ErrorCodesSection = () => {
  const errorCodes = [
    { code: 200, status: "OK", desc: "Request successful. Data returned in 'data' field.", color: "text-success", bg: "bg-success/10" },
    { code: 201, status: "Created", desc: "Resource created successfully.", color: "text-success", bg: "bg-success/10" },
    { code: 400, status: "Bad Request", desc: "Invalid request body or missing required parameters. Check your JSON format.", color: "text-warning", bg: "bg-warning/10" },
    { code: 401, status: "Unauthorized", desc: "Missing or invalid JWT token. Call auth/login first to get a valid token.", color: "text-destructive", bg: "bg-destructive/10" },
    { code: 403, status: "Forbidden", desc: "Valid token but insufficient permissions. Check API key permissions or user role.", color: "text-destructive", bg: "bg-destructive/10" },
    { code: 404, status: "Not Found", desc: "Endpoint or resource doesn't exist. Verify the URL path.", color: "text-warning", bg: "bg-warning/10" },
    { code: 429, status: "Too Many Requests", desc: "Rate limit exceeded. Wait and retry. Check rate_limit_per_minute for the endpoint.", color: "text-warning", bg: "bg-warning/10" },
    { code: 500, status: "Server Error", desc: "Internal server error. Contact admin. Include request ID from response headers.", color: "text-destructive", bg: "bg-destructive/10" },
    { code: 503, status: "Service Unavailable", desc: "Service temporarily down. Implement exponential backoff retry.", color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4 neural-border">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" /> Error Handling Reference
        </h3>
        <p className="text-xs text-muted-foreground mb-4">All ACRY APIs return consistent error responses. Handle these in your Flutter app:</p>

        <div className="space-y-2">
          {errorCodes.map(err => (
            <div key={err.code} className={`rounded-lg p-3 ${err.bg} flex items-start gap-3`}>
              <span className={`text-sm font-bold font-mono ${err.color} w-10`}>{err.code}</span>
              <div className="flex-1">
                <span className={`text-xs font-semibold ${err.color}`}>{err.status}</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">{err.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-xl p-4 neural-border">
        <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <Code className="w-3.5 h-3.5 text-primary" /> Flutter Error Handler Example
        </h4>
        <CodeBlock code={`Future<T> safeApiCall<T>(Future<T> Function() call) async {
  try {
    return await call();
  } on AcryApiException catch (e) {
    switch (e.code) {
      case 401:
        // Redirect to login
        Navigator.pushReplacementNamed(context, '/login');
        break;
      case 403:
        showSnackBar('Permission denied');
        break;
      case 429:
        // Retry after delay
        await Future.delayed(Duration(seconds: 2));
        return await call();
      case 500:
        showSnackBar('Server error. Try again later.');
        break;
      default:
        showSnackBar(e.message);
    }
    rethrow;
  }
}`} lang="dart" />
      </div>
    </div>
  );
};

// ─── Code Block Helper ───
const CodeBlock = ({ code, lang }: { code: string; lang: string }) => {
  const { toast } = useToast();
  return (
    <div className="relative group">
      <pre className="text-[10px] bg-secondary rounded-lg p-3 font-mono text-foreground overflow-x-auto">{code}</pre>
      <button
        onClick={() => { navigator.clipboard.writeText(code); toast({ title: "Code copied!" }); }}
        className="absolute top-2 right-2 p-1.5 bg-background/80 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background">
        <Copy className="w-3 h-3 text-primary" />
      </button>
    </div>
  );
};

export default FlutterApiHub;
