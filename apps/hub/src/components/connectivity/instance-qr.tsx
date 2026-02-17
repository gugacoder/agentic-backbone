import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, CheckCircle2, AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { evolutionInstanceQRQuery, evolutionInstanceQuery } from "@/api/evolution";

interface InstanceQRProps {
  instanceName: string;
}

type QRState = "idle" | "loading" | "error" | "active" | "linked" | "expired" | "exhausted";

export function InstanceQR({ instanceName }: InstanceQRProps) {
  const [qrState, setQrState] = useState<QRState>("idle");
  const [countdown, setCountdown] = useState(60);
  const [attempts, setAttempts] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const shouldFetchQR = qrState === "loading";
  const { data: qrData, isFetching: qrFetching, isError: qrIsError } = useQuery(
    evolutionInstanceQRQuery(instanceName, shouldFetchQR)
  );

  // Poll instance state while QR is active
  const shouldPoll = qrState === "active";
  const { data: instance } = useQuery({
    ...evolutionInstanceQuery(instanceName),
    refetchInterval: shouldPoll ? 2_000 : false,
  });

  // When QR data arrives, transition to active
  useEffect(() => {
    if (qrState === "loading" && qrData && !qrFetching) {
      setQrState("active");
      setCountdown(60);
    }
  }, [qrData, qrFetching, qrState]);

  // When QR query fails during loading, transition to error
  useEffect(() => {
    if (qrState === "loading" && qrIsError && !qrFetching) {
      setQrState("error");
    }
  }, [qrState, qrIsError, qrFetching]);

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

  // Detect linking
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
    setQrState("loading");
  }

  function retryQR() {
    setQrState("loading");
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
              <AlertTriangle className="h-16 w-16 text-destructive" />
              <p className="text-sm font-medium text-destructive">Falha ao gerar QR code</p>
              <p className="text-sm text-muted-foreground text-center">Nao foi possivel conectar ao servidor. Verifique se o backbone esta rodando.</p>
              <Button onClick={retryQR}>Tentar novamente</Button>
            </>
          )}

          {qrState === "active" && qrData && (
            <>
              <div className="border rounded-lg p-4 bg-white w-full md:w-auto">
                <img
                  src={qrData.base64.startsWith("data:") ? qrData.base64 : `data:image/png;base64,${qrData.base64}`}
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
              <p className="text-sm font-medium">Instancia vinculada com sucesso!</p>
            </>
          )}

          {qrState === "expired" && (
            <>
              <AlertCircle className="h-16 w-16 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">QR code expirado.</p>
              {attempts < 5 ? (
                <Button onClick={requestQR}>Gerar Novo</Button>
              ) : (
                <p className="text-sm text-destructive text-center">Limite de tentativas atingido. Recarregue a pagina para tentar novamente.</p>
              )}
            </>
          )}

          {qrState === "exhausted" && (
            <>
              <AlertCircle className="h-16 w-16 text-destructive" />
              <p className="text-sm text-destructive text-center">Limite de tentativas atingido. Recarregue a pagina para tentar novamente.</p>
            </>
          )}

          {qrState !== "exhausted" && attempts > 0 && (
            <p className="text-xs text-muted-foreground">Tentativa {attempts}/5</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
