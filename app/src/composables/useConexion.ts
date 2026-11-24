import { onUnmounted, ref } from 'vue';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import type { PluginListenerHandle } from '@capacitor/core';

export function useConexion() {
  const conectado = ref(true);
  const tipo = ref('unknown');
  let listenerHandle: PluginListenerHandle | null = null;
  let desmontado = false;

  void (async () => {
    try {
      const estadoInicial = await Network.getStatus();
      if (!desmontado) {
        conectado.value = estadoInicial.connected;
        tipo.value = estadoInicial.connectionType;
      }

      const handle = await Network.addListener('networkStatusChange', (estado) => {
        if (!desmontado) {
          conectado.value = estado.connected;
          tipo.value = estado.connectionType;
        }
      });

      if (desmontado) {
        await handle.remove();
      } else {
        listenerHandle = handle;
      }
    } catch {
      // En entornos sin plugin disponible mantiene los valores por defecto
    }
  })();

  onUnmounted(() => {
    desmontado = true;
    if (listenerHandle) {
      void listenerHandle.remove();
      listenerHandle = null;
    }
  });

  return { conectado, tipo };
}

export async function vibrar() {
  if (!Capacitor.isNativePlatform()) return;
  await Haptics.impact({ style: ImpactStyle.Light });
}