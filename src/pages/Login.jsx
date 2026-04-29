import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ matricula: "", senha: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(form.matricula, form.senha);
      navigate("/");
    } catch (err) {
      setError("Matrícula ou senha inválidos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f0f4f8", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: "Arial, sans-serif", fontSize: "14px" }}>
      <div style={{ backgroundColor: "#fff", border: "1px solid #e0e0e0", borderRadius: "12px", padding: "32px 28px", width: "100%", maxWidth: "380px" }}>

        <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#1a1a1a", margin: "0 0 6px 0" }}>Visão de Dono</h2>
        <p style={{ fontSize: "13px", color: "#888", margin: "0 0 24px 0" }}>Acesso restrito — informe sua matrícula</p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px" }}>
            <label style={{ fontSize: "11px", color: "#888" }}>Matrícula</label>
            <input
              type="text"
              value={form.matricula}
              onChange={(e) => setForm({ ...form, matricula: e.target.value })}
              placeholder="Ex: 27630"
              required
              style={{ width: "100%", padding: "7px 9px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px", background: "#fff", color: "#222", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "18px" }}>
            <label style={{ fontSize: "11px", color: "#888" }}>Senha</label>
            <input
              type="password"
              value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
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
      </div>
    </div>
  );
}