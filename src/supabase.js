// =========================================================
// Supabase 연결 설정
// =========================================================
// Supabase Dashboard
// → Project Settings
// → API
// → Project URL / anon public key 확인 후 아래에 붙여넣기

const SUPABASE_URL = "https://zramxfjvcwibfzmujgzc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYW14Zmp2Y3dpYmZ6bXVqZ3pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMTg5MjIsImV4cCI6MjA5NTU5NDkyMn0.uAy7pIrcirT9_lxRXEwjHZqu6i6bkimtP380nrRzgOU";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
