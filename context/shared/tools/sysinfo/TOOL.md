---
name: sysinfo
description: Coleta informações do sistema (CPU, memória, disco, rede, OS)
---

# sysinfo

Coleta um snapshot completo do estado da máquina. Cross-platform (Windows e Linux).

## Uso

```bash
node <tool_dir>/sysinfo.mjs
```

Retorna um relatório em texto estruturado com seções: OS, CPU, Memória, Disco, Rede e Top Processos.
