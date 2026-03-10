import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Activity } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth";
import { login as apiLogin, loginLaravel } from "@/api/auth";

const ciaSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

const operatorSchema = z.object({
  username: z.string().min(1, "Username é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

type CiaFormValues = z.infer<typeof ciaSchema>;
type OperatorFormValues = z.infer<typeof operatorSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" }) as { redirect?: string };
  const authLogin = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);

  const ciaForm = useForm<CiaFormValues>({
    resolver: zodResolver(ciaSchema),
    defaultValues: { email: "", password: "" },
  });

  const operatorForm = useForm<OperatorFormValues>({
    resolver: zodResolver(operatorSchema),
    defaultValues: { username: "", password: "" },
  });

  const ciaLoading = ciaForm.formState.isSubmitting;
  const operatorLoading = operatorForm.formState.isSubmitting;

  async function onCiaSubmit(values: CiaFormValues) {
    try {
      const { token } = await loginLaravel(values);
      await authLogin(token);
      toast.success("Login realizado com sucesso");
      navigate({ to: search.redirect || "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no login");
    }
  }

  async function onOperatorSubmit(values: OperatorFormValues) {
    try {
      const { token } = await apiLogin(values);
      await authLogin(token);
      toast.success("Login realizado com sucesso");
      navigate({ to: search.redirect || "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no login");
    }
  }

  function PasswordToggle() {
    return (
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {showPassword ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-xl">Backbone Hub</CardTitle>
            <CardDescription>Entrar no sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="cia">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="cia">Usuário Cia</TabsTrigger>
                <TabsTrigger value="operator">Operador</TabsTrigger>
              </TabsList>

              <TabsContent value="cia">
                <Form {...ciaForm}>
                  <form
                    onSubmit={ciaForm.handleSubmit(onCiaSubmit)}
                    className="grid gap-4"
                  >
                    <FormField
                      control={ciaForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="seu@email.com"
                              autoComplete="email"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={ciaForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Senha"
                                autoComplete="current-password"
                                className="pr-10"
                                {...field}
                              />
                              <PasswordToggle />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={ciaLoading}
                    >
                      {ciaLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Entrar
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="operator">
                <Form {...operatorForm}>
                  <form
                    onSubmit={operatorForm.handleSubmit(onOperatorSubmit)}
                    className="grid gap-4"
                  >
                    <FormField
                      control={operatorForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Username"
                              autoComplete="username"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={operatorForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Senha"
                                autoComplete="current-password"
                                className="pr-10"
                                {...field}
                              />
                              <PasswordToggle />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={operatorLoading}
                    >
                      {operatorLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Entrar
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
