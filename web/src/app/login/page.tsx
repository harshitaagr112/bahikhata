"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpenCheck } from "lucide-react";
import { login } from "@/lib/api";
import { Button, Card, ErrorBanner, Field, TextInput } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(username, password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-[var(--accent-darker)] text-white shadow-sm shadow-blue-900/20">
            <BookOpenCheck size={22} strokeWidth={2.25} />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">Khata</h1>
            <p className="text-sm text-neutral-500">Sign in to continue</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <ErrorBanner message={error} />
          <Field label="Username">
            <TextInput
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </Field>
          <Field label="Password">
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
