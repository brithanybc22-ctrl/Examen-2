import { computed, ref } from 'vue';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Device } from '@capacitor/device';
import { api } from '@/services/api';

export interface Usuario { id: number; nombre: string }

const CLAVE_TOKEN = 'token';
const CLAVE_USUARIO = 'usuario';

// Estado compartido por toda la app 
const token = ref<string | null>(null);
const usuario = ref<Usuario | null>(null);
let tokenCargado = false;

/** YA IMPLEMENTADO */
export const obtenerToken = () => token.value;

export async function olvidarSesion() {
  token.value = null;
  usuario.value = null;
  await Promise.all([
    SecureStorage.remove(CLAVE_TOKEN),
    SecureStorage.remove(CLAVE_USUARIO),
  ]);
}

export function useAuth() {
  const estaAutenticado = computed(() => token.value !== null);
  async function login(email: string, password: string) {
    const info = await Device.getInfo();
    const device_name = `${info.platform} ${info.model}`.trim().slice(0, 60);

    const data = await api<{ token: string; usuario: Usuario }>('/login', {
      method: 'POST',
      body: { email, password, device_name },
    });

    token.value = data.token;
    usuario.value = data.usuario;

    await Promise.all([
      SecureStorage.set(CLAVE_TOKEN, data.token),
      SecureStorage.set(CLAVE_USUARIO, JSON.stringify(data.usuario)),
    ]);
  }

  async function cargarToken() {
    if (tokenCargado) return;
    tokenCargado = true;

    const [tokenGuardado, usuarioGuardado] = await Promise.all([
      SecureStorage.get(CLAVE_TOKEN),
      SecureStorage.get(CLAVE_USUARIO),
    ]);

    token.value = typeof tokenGuardado === 'string' && tokenGuardado.length > 0 ? tokenGuardado : null;

    if (typeof usuarioGuardado === 'string' && usuarioGuardado.length > 0) {
      try {
        usuario.value = JSON.parse(usuarioGuardado) as Usuario;
      } catch {
        usuario.value = null;
      }
    } else {
      usuario.value = null;
    }
  }

  async function cerrarSesion() {
    try {
      await api('/logout', { method: 'POST' });
    } finally {
      await olvidarSesion();
    }
  }

  return { usuario, estaAutenticado, login, cargarToken, cerrarSesion };
}