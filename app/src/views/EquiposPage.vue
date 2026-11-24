<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Equipos</ion-title>
        <ion-buttons slot="end">
          <ion-button router-link="/tabs/equipos/nuevo" aria-label="Nuevo equipo">
            <ion-icon slot="icon-only" :icon="add" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="q" :debounce="400" placeholder="Buscar por código o nombre" @ion-input="buscar" />
      </ion-toolbar>
      <!-- YA IMPLEMENTADO: depende de useConexion() -->
      <ion-toolbar v-if="!conectado" color="warning">
        <ion-title size="small">Sin conexión: los datos pueden estar desactualizados</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <!-- ion-refresher que vuelve a la página 1 -->
      <ion-refresher slot="fixed" @ionRefresh="refrescar">
        <ion-refresher-content />
      </ion-refresher>

      <!-- Skeleton en la primera carga -->
      <template v-if="cargando && equipos.length === 0">
        <ion-list>
          <ion-item v-for="n in 6" :key="n">
            <ion-label>
              <h3><ion-skeleton-text :animated="true" style="width: 60%" /></h3>
              <p><ion-skeleton-text :animated="true" style="width: 40%" /></p>
            </ion-label>
            <ion-skeleton-text slot="end" :animated="true" style="width: 72px; height: 22px" />
          </ion-item>
        </ion-list>
      </template>

      <!-- Todo error con botón Reintentar -->
      <div v-else-if="error && equipos.length === 0" class="estado-vacio">
        <ion-icon :icon="cloudOfflineOutline" size="large" />
        <p>{{ error }}</p>
        <ion-button @click="cargar(true)">Reintentar</ion-button>
      </div>

      <!-- Estado vacío cuando no hay resultados -->
      <div v-else-if="equipos.length === 0" class="estado-vacio">
        <ion-icon :icon="searchOutline" size="large" />
        <p>No hay equipos para mostrar.</p>
      </div>

      <!-- Listado + Eliminación deslizable -->
      <template v-else>
        <ion-list>
          <ion-item-sliding v-for="equipo in equipos" :key="equipo.id">
            <ion-item :router-link="`/tabs/equipos/${equipo.id}/editar`" detail>
              <ion-label>
                <h2>{{ equipo.nombre }}</h2>
                <p>{{ equipo.codigo }} · {{ equipo.categoria?.nombre ?? 'Sin categoría' }}</p>
              </ion-label>
              <ion-badge slot="end" :color="colorEstado[equipo.estado]">
                {{ equipo.estado }}
              </ion-badge>
            </ion-item>

            <ion-item-options side="end">
              <ion-item-option color="danger" @click="confirmarEliminacion(equipo, $event)">
                <ion-icon slot="icon-only" :icon="trashOutline" />
                Eliminar
              </ion-item-option>
            </ion-item-options>
          </ion-item-sliding>
        </ion-list>

        <ion-infinite-scroll :disabled="!hayMas" @ionInfinite="cargarMas">
          <ion-infinite-scroll-content loading-text="Cargando más equipos..." />
        </ion-infinite-scroll>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonSearchbar, IonContent,
  IonRefresher, IonRefresherContent, IonList, IonItem, IonLabel, IonSkeletonText, IonBadge,
  IonItemSliding, IonItemOptions, IonItemOption, IonInfiniteScroll, IonInfiniteScrollContent,
  alertController, onIonViewWillEnter,
} from '@ionic/vue';
import type { InfiniteScrollCustomEvent, RefresherCustomEvent } from '@ionic/vue';
import { add, cloudOfflineOutline, searchOutline, trashOutline } from 'ionicons/icons';
import { eliminar, listar, type Equipo, type Estado } from '@/services/equipos';
import { ErrorApi } from '@/services/errores';
import { mostrarToast } from '@/services/avisos';
import { useConexion, vibrar } from '@/composables/useConexion';

const colorEstado: Record<Estado, string> = {
  disponible: 'success',
  prestado: 'warning',
  mantenimiento: 'medium',
};

const { conectado } = useConexion();

const equipos = ref<Equipo[]>([]);
const pagina = ref(0);
const ultimaPagina = ref(1);
const q = ref('');
const cargando = ref(false);
const error = ref('');
const hayMas = computed(() => pagina.value < ultimaPagina.value);

async function cargar(reiniciar = false) {
  if (cargando.value) return;

  const siguientePagina = reiniciar ? 1 : pagina.value + 1;
  cargando.value = true;
  if (reiniciar) {
    error.value = '';
  }

  try {
    const respuesta = await listar(siguientePagina, q.value.trim());
    equipos.value = reiniciar ? respuesta.data : [...equipos.value, ...respuesta.data];
    pagina.value = respuesta.meta.current_page;
    ultimaPagina.value = respuesta.meta.last_page;
  } catch (err) {
    if (err instanceof ErrorApi) {
      const cuerpo = err.cuerpo as { mensaje?: string; message?: string } | null;
      error.value = cuerpo?.mensaje || cuerpo?.message || 'No fue posible cargar los equipos.';
    } else {
      error.value = 'No fue posible cargar los equipos.';
    }
  } finally {
    cargando.value = false;
  }
}

onIonViewWillEnter(() => {
  void cargar(true);
});

const buscar = () => cargar(true);

async function refrescar(evento: RefresherCustomEvent) {
  try {
    await cargar(true);
  } finally {
    await evento.target.complete();
  }
}

async function cargarMas(evento: InfiniteScrollCustomEvent) {
  try {
    if (hayMas.value) {
      await cargar(false);
    }
  } finally {
    await evento.target.complete();
  }
}

async function confirmarEliminacion(equipo: Equipo, evento: Event) {
  const objetivo = evento.target as HTMLElement | null;
  const sliding = objetivo?.closest('ion-item-sliding') as (HTMLElement & { close?: () => Promise<void> }) | null;
  if (sliding?.close) {
    await sliding.close();
  }

  const alert = await alertController.create({
    header: 'Confirmar eliminación',
    message: `¿Desea eliminar el equipo "${equipo.codigo} · ${equipo.nombre}"?`,
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Eliminar', role: 'destructive' },
    ],
  });

  await alert.present();
  const { role } = await alert.onDidDismiss();
  if (role !== 'destructive') return;

  try {
    await eliminar(equipo.id);
    equipos.value = equipos.value.filter((item) => item.id !== equipo.id);
    await vibrar();
    await mostrarToast('Equipo eliminado correctamente.', 'success');
  } catch (err) {
    if (err instanceof ErrorApi) {
      const cuerpo = err.cuerpo as { mensaje?: string; message?: string } | null;
      if (err.status === 409) {
        await mostrarToast(cuerpo?.mensaje || 'No se puede eliminar un equipo prestado', 'warning');
        return;
      }
      if (err.status === 404) {
        equipos.value = equipos.value.filter((item) => item.id !== equipo.id);
        await mostrarToast('El equipo ya no existe.', 'medium');
        return;
      }
      await mostrarToast(cuerpo?.mensaje || cuerpo?.message || 'No se pudo eliminar el equipo', 'danger');
      return;
    }
    await mostrarToast('No se pudo eliminar el equipo', 'danger');
  }
}
</script>