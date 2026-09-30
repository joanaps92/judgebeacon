# JudgeBeacon

Contador de Magic para una mesa de 2, 3 o 4 jugadores, en un único dispositivo iOS o Android. Primera implementación de la fase 1 del documento técnico: funcionamiento local, sin cuentas, backend ni conexión durante la partida.

## Arranque

Requisitos: Node 24 y npm 11. Desde la raíz:

```sh
npm ci
npm start
```

Abre el proyecto con una versión de Expo Go compatible con SDK 57, o utiliza un development build. La interfaz utiliza Angular Native 0.1.1, Angular 22 y Expo 57. Angular Native está en alpha; se ha conservado su plantilla oficial y su configuración de Metro.

```sh
npm run android -w @judgebeacon/mobile
npm run ios -w @judgebeacon/mobile
```

iOS Simulator requiere macOS. La aplicación distribuida mediante un build nativo puede ejecutarse sin Metro y sin Internet; la sesión de desarrollo necesita Metro para cargar el código.

## Funciones implementadas

- Creación local, formatos predefinidos y personalizado, nombres y 16 temas.
- Dos zonas en vertical; tres o cuatro en horizontal. El tercer jugador puede sentarse a izquierda o derecha. Orden horario desde quien gana la tirada inicial.
- Toques en la mitad izquierda o derecha para modificar vidas, veneno o daño de comandante por rival. Franja completa o minimalista, sin controles +1/-1 visibles.
- Monarca único, menú por jugador, histórico virtualizado y deshacer mediante eventos compensatorios.
- Dados d6/d8/d10/d12/d20 y monedas, individuales o globales; animación silenciosa y tapete que bloquea la mesa hasta cerrarlo.
- Autoguardado en SQLite, continuidad tras reinicio, respaldo JSON versionado e importación validada.
- Finalización con resumen y posibilidad de reabrir, sin asignar un ganador de partida.
- Contratos para sincronización futura y QR deshabilitado. No hay implementación de red.

## Estructura

| Directorio                | Responsabilidad                                               |
| ------------------------- | ------------------------------------------------------------- |
| `apps/mobile`             | Angular Native, señales, pantallas y adaptadores Expo         |
| `packages/game-model`     | Estado, comandos, eventos, formatos y contratos serializables |
| `packages/game-engine`    | Transiciones puras con reloj, IDs y aleatoriedad inyectados   |
| `packages/game-storage`   | Validación de respaldos y abstracción de almacenamiento       |
| `packages/game-ui`        | Temas, etiquetas y geometría de las zonas                     |
| `packages/sync-contracts` | Interfaces para fases posteriores                             |

La UI emite comandos. El servicio calcula el siguiente estado, espera a que se guarde y solo entonces lo publica. Un fallo de escritura mantiene el estado anterior y muestra el error. SQLite guarda una única clave de forma atómica; la cola de persistencia conserva el orden y se recupera de fallos.

## Verificación

```sh
npm test
npm run test:mobile
npm run typecheck
npm run format:check
npm run bundle:check
```

`bundle:check` comprueba los bundles JavaScript de ambas plataformas sin compilar bytecode. Para verificar también Hermes en una máquina que permita ejecutar su compilador:

```sh
npm exec -w @judgebeacon/mobile -- expo export --platform android --platform ios
```

Las pruebas de interfaz utilizan el renderer de Angular Native con una capa nativa simulada y mocks de las APIs de Expo. No verifican Yoga, orientación física, teclado, animaciones ni el selector de archivos del sistema.

En el entorno Windows de implementación, Control de aplicaciones bloquea `hermesc.exe`. Los bundles JavaScript sí se han generado. No hay emulador/dispositivo disponible: la aceptación visual y funcional en iOS/Android queda pendiente; véase [el plan de pruebas](docs/aceptacion-fase-1.md).

## Decisiones de dominio

- Las vidas admiten negativos; veneno y daño de comandante no. El daño de comandante es un registro independiente: no modifica vidas automáticamente.
- Deshacer un contador compensa su delta sobre el valor actual, conservando cambios posteriores. Se rechaza si generaría veneno o daño negativo. Las transferencias de Monarca se deshacen desde la última transferencia pendiente.
- Los empates repiten solo entre quienes comparten el máximo. Se muestran y registran únicamente los resultados de la ronda resolutiva; no se mezclan puntuaciones de rondas distintas. El primer jugador determina el orden horario de todos los asientos.
- El resultado abierto también se guarda. Tras reiniciar se recupera el bloqueo hasta cerrar ese resultado.
- La restauración desde almacenamiento conserva exactamente el historial. Una importación de archivo añade un evento de restauración y devuelve el control de todas las zonas al dispositivo local.
- El esquema actual es v1. Se rechazan versiones desconocidas, referencias inconsistentes, datos de eventos inválidos y archivos de más de 20 MB, antes de escribir sobre la partida existente.

Referencias del stack: [Angular Native](https://ng-native.com/guide/getting-started), [Expo](https://docs.expo.dev/).
