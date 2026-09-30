# Aplicación móvil JudgeBeacon

Interfaz Angular Native con Expo para partidas locales offline. Consulta el [README principal](../../README.md) para instalar, ejecutar y verificar el workspace, y el [plan de aceptación](../../docs/aceptacion-fase-1.md) antes de cerrar la fase.

`src/main.ts` registra el renderer nativo; `src/app/app.ts` coordina las pantallas; `player-zone.ts` presenta una zona táctil; `game.service.ts` conecta comandos, persistencia y APIs del dispositivo. Las reglas viven en `packages/game-engine`.

La configuración de Metro, el arranque del renderer y los iconos provisionales proceden de la plantilla oficial `@ng-native/template` 0.1.1, bajo la licencia incluida en esta carpeta.
