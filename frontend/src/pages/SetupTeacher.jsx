import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  UserRound,
  CheckCircle2,
} from "lucide-react";
import api from "../services/api";

export default function SetupTeacher() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    teacher_id: "",
    name: "",
    email: "",
    password: "",
    confirm_password: "",
    setup_code: "",
  });
  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const update = (key) => (e) =>
    setForm((v) => ({ ...v, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 8)
      return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirm_password)
      return setError("Passwords do not match.");
    setLoading(true);
    try {
      await api.post("/auth/setup-teacher", form);
      setSuccess(true);
      setTimeout(() => navigate("/login"), 900);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to create teacher credentials.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-lg">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>
        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">
                Create teacher credentials
              </h1>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Use the setup code configured for your deployment. This prevents
                open public teacher registration.
              </p>
            </div>
          </div>
          {success ? (
            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
              <h2 className="mt-3 font-semibold text-emerald-900">
                Teacher account created
              </h2>
              <p className="mt-1 text-sm text-emerald-700">
                Returning to the sign-in page…
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-5">
              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <Field
                icon={UserRound}
                label="Teacher ID"
                value={form.teacher_id}
                onChange={update("teacher_id")}
                placeholder="T003"
              />
              <Field
                icon={UserRound}
                label="Full name"
                value={form.name}
                onChange={update("name")}
                placeholder="Dr. Sharma"
              />
              <Field
                icon={Mail}
                type="email"
                label="Email address"
                value={form.email}
                onChange={update("email")}
                placeholder="teacher@college.edu"
              />
              <Password
                label="Password"
                value={form.password}
                onChange={update("password")}
                show={show}
                toggle={() => setShow((v) => !v)}
              />
              <Password
                label="Confirm password"
                value={form.confirm_password}
                onChange={update("confirm_password")}
                show={showConfirm}
                toggle={() => setShowConfirm((v) => !v)}
              />
              <Field
                icon={KeyRound}
                label="Setup code"
                value={form.setup_code}
                onChange={update("setup_code")}
                placeholder="Your configured setup code"
              />
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-xs leading-5 text-blue-900">
                <ShieldCheck className="mb-2 h-4 w-4 text-blue-600" />
                Keep the setup code private. For production, change it in your
                environment variables.
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Creating…" : "Create teacher account"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

function Field({ icon: Icon, label, type = "text", ...props }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          {...props}
          type={type}
          required
          className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
        />
      </div>
    </div>
  );
}
function Password({ label, value, onChange, show, toggle }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <LockIcon />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          minLength={8}
          required
          className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-11 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
        />
        <button
          type="button"
          onClick={toggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
function LockIcon() {
  return (
    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
  );
}
