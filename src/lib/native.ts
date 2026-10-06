import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'

// Só roda dentro do app (Android/iOS). No navegador não faz nada.
export function setupNative() {
  if (!Capacitor.isNativePlatform()) return

  StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
  if (Capacitor.getPlatform() === 'android') {
    StatusBar.setBackgroundColor({ color: '#1478c4' }).catch(() => {})
  }

  // Botão "voltar" do Android: volta uma tela; na lista de mesas, sai do app.
  CapacitorApp.addListener('backButton', () => {
    if (window.location.pathname === '/mesas' || window.location.pathname === '/') {
      CapacitorApp.exitApp()
    } else {
      window.history.back()
    }
  })
}
