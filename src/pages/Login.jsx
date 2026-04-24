"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { useAuthStore } from "../../lib/store/auth.store";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/login", form);
      setAuth(data.token, data.user, data.barbershop);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.error || "Email ou senha invalidos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f0f4f8", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: "Arial, sans-serif", fontSize: "14px" }}>
      <div style={{ backgroundColor: "#fff", border: "1px solid #e0e0e0", borderRadius: "12px", padding: "32px 28px", width: "100%", maxWidth: "380px" }}>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
          <Image src="/logo.png" alt="Navalha CRM" width={40} height={40} style={{ objectFit: "contain" }} />
          <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#1a1a1a", margin: 0 }}>Navalha CRM</h2>
        </div>

        <p style={{ fontSize: "13px", color: "#888", margin: "0 0 24px 0" }}>Gestao inteligente para barbearias</p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px" }}>
            <label style={{ fontSize: "11px", color: "#888" }}>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="seu@email.com"
              required
              style={{ width: "100%", padding: "7px 9px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px", background: "#fff", color: "#222", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "18px" }}>
            <label style={{ fontSize: "11px", color: "#888" }}>Senha</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              required
              style={{ width: "100%", padding: "7px 9px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px", background: "#fff", color: "#222", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {error && (
            <p style={{ color: "#c62828", fontSize: "12px", margin: "0 0 10px 0" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "8px 18px", backgroundColor: "#1a1a1a", color: "#fff", border: "2px solid #1a1a1a", borderRadius: "6px", fontSize: "13px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: "12px", color: "#888", marginTop: "20px" }}>
          Nao tem conta?{" "}
          <a href="/register" style={{ color: "#d97706", fontWeight: "600" }}>Cadastre sua barbearia</a>
        </p>
      </div>
    </div>
  );
}