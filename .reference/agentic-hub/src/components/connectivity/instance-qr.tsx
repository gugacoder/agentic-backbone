import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, CheckCircle2, AlertCircle, AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { evolutionInstanceQRQuery, evolutionInstanceQuery, friendlyMessage } from "@/api/evolution";

interface InstanceQRProps {
  instanceName: string;
}

type QRState = "idle" | "loading" | "error" | "active" | "linked" | "expired" | "exhausted";

export function InstanceQR({ instanceName }: InstanceQRProps) {
  const [qrState, setQrState] = useState<QRState>("idle");
  const [qrError, setQrError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [attempts, setAttempts] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const shouldFetchQR = qrState === "loading";
  const { data: qrResult, isFetching: qrFetching } = useQuery(
    evolutionInstanceQRQuery(instanceName, shouldFetchQR)
  );

  // Poll instance state while QR is active
  const shouldPoll = qrState === "active";
  const { data: instanceResult } = useQuery({
    ...evolutionInstanceQuery(instanceName),
    refetchInterval: shouldPoll ? 2_000 : false,
  });
  const instance = instanceResult?.ok ? instanceResult.data : null;

  // Detect instance already linked on mount
  useEffect(() => {
    if (qrState === "idle" && instance?.state === "open") {
      setQrState("linked");
    }
  }, [instance?.state, qrState]);

  // When QR result arrives, transition based on ok/error
  useEffect(() => {
    if (qrState !== "loading" || qrFetching) return;
    if (!qrResult) return;

    if (qrResult.ok && qrResult.data) {
      setQrState("active");
      setCountdown(60);
      setQrError(null);
    } else if (!qrResult.ok) {
      setQrState("error");
      setQrError(qrResult.error ?? null);
    }
  }, [qrResult, qrFetching, qrState]);

  // Countdown timer
  useEffect(() => {
    if (qrState === "active") {
      countdownRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            setQrState("expired");
            return 0;
          }
          return c - 1;
        });
      }, 1_000);
      return () => {
        if (countdownRef.current) clearInterval(countdownRef.current);
      };
    }
  }, [qrState]);

  // Detect linking while QR is active
  useEffect(() => {
    if (qrState === "active" && instance?.state === "open") {
      setQrState("linked");
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
  }, [instance?.state, qrState]);

  function requestQR() {
    if (attempts >= 5) {
      setQrState("exhausted");
      return;
    }
    setAttempts((a) => a + 1);
    setQrError(null);
    setQrState("loading");
  }

  function retryQR() {
    setQrError(null);
    setQrState("loading");
  }

  function resetAttempts() {
    setAttempts(0);
    setQrError(null);
    setQrState("idle");
  }

  return (
    <div className="md:max-w-md md:mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">QR Code</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-6">
          {qrState === "idle" && (
            <>
              <QrCode className="h-16 w-16 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">Gere um QR code para vincular esta instancia ao WhatsApp.</p>
              <Button onClick={requestQR}>Gerar QR Code</Button>
            </>
          )}

          {qrState === "loading" && (
            <>
              <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Gerando QR code...</p>
            </>
          )}

          {qrState === "error" && (
            <>
              <AlertTriangle className="h-16 w-16 text-muted-foreground" />
              <p className="text-sm font-medium">{friendlyMessage(qrError ?? "qr_unavailable")}</p>
              <p className="text-sm text-muted-foreground text-center">Nao foi possivel gerar o QR code. Tente novamente.</p>
              <Button variant="outline" onClick={retryQR}>Tentar novamente</Button>
            </>
          )}

          {qrState === "active" && qrResult?.ok && qrResult.data && (
            <>
              <div className="border rounded-lg p-4 bg-white w-full md:w-auto">
                <img
                  src={qrResult.data.base64.startsWith("data:") ? qrResult.data.base64 : `data:image/png;base64,${qrResult.data.base64}`}
                  alt="QR Code WhatsApp"
                  className="w-full aspect-square md:w-64 md:h-64"
                />
              </div>
              <p className="text-sm text-muted-foreground">Escaneie com WhatsApp</p>
              <p className="text-sm font-medium">Expira em {countdown}s</p>
            </>
          )}

          {qrState === "linked" && (
            <>
              <CheckCircle2 className="h-16 w-16 text-chart-2" />
              <p className="text-sm font-medium">Instancia ja vinculada</p>
              {(instance?.profileName || instance?.owner) && (
                <p className="text-sm text-muted-foreground">{instance.profileName ?? instance.owner}</p>
              )}
            </>
          )}

          {qrState === "expired" && (
            <>
              <AlertCircle className="h-16 w-16 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">QR code expirado.</p>
              {attempts < 5 ? (
                <Button onClick={requestQR}>Gerar Novo</Button>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground text-center">Limite de tentativas atingido.</p>
                  <Button variant="outline" onClick={resetAttempts}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Recomecar
                  </Button>
                </>
              )}
            </>
          )}

          {qrState === "exhausted" && (
            <>
              <AlertCircle className="h-16 w-16 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">Limite de tentativas atingido.</p>
              <Button variant="outline" onClick={resetAttempts}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Recomecar
              </Button>
            </>
          )}

          {qrState !== "exhausted" && qrState !== "linked" && attempts > 0 && (
            <p className="text-xs text-muted-foreground">Tentativa {attempts}/5</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
