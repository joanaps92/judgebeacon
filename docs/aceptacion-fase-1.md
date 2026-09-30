# Aceptación de fase 1

La implementación y las pruebas automatizadas no sustituyen una sesión en dispositivos reales. Esta lista registra lo que falta comprobar antes de considerar cerrada la fase 1.

## Automatizado

- Motor: creación 2/3/4, vidas negativas, veneno, comandante, Monarca, deshacer selectivo, bloqueo, dados, monedas, empates, finalizar/reabrir.
- Respaldos: ida y vuelta de estado completo, versión desconocida, referencias inválidas, modo local tras importación y errores de escritura.
- Interfaz: configuración de jugadores y creación, cierre de la resolución inicial y modificación táctil de vidas, con módulos nativos simulados.
- TypeScript y templates Angular estrictos.
- Bundles JavaScript Android e iOS generados por Metro.

## Pendiente en móvil y tablet

- [ ] Android e iOS: crear salas de 2, 3 y 4 jugadores y comprobar orientación bloqueada.
- [ ] En 3 jugadores, alternar lateral izquierdo/derecho y verificar que el jugador 3 ocupa ese lado; comprobar giro del contador y menú.
- [ ] Comprobar legibilidad sin recortes en móvil pequeño y tablet, nombres largos y vidas de varios dígitos.
- [ ] Comprobar izquierda/derecha desde cada asiento y todos los contadores, con franjas completa y minimalista.
- [ ] Transferir Monarca y deshacer desde histórico, conservando la cronología.
- [ ] Lanzar cada dado y moneda individual/global; confirmar ausencia de sonido/vibración y bloqueo incluso con el botón Atrás.
- [ ] Matar la aplicación con una resolución abierta, reiniciar y verificar el mismo resultado y bloqueo.
- [ ] Cambiar valores, matar y reiniciar el proceso: vidas, selección de contador, temas, orden e historial deben coincidir.
- [ ] Exportar usando el selector nativo, crear otra partida e importar el archivo: verificar restauración completa.
- [ ] Importar JSON truncado, versión distinta y referencias incorrectas: mostrar error sin reemplazar la partida.
- [ ] Finalizar, exportar y reabrir; verificar resumen e historial sin ganador de partida.
- [ ] Probar todos los flujos con modo avión en un build instalado, sin Metro.
- [ ] VoiceOver/TalkBack: identificar zonas táctiles y opciones; bloquear foco/interacción con el tapete abierto.

## Distribución

- [ ] Compilar Hermes en un entorno donde el ejecutable esté permitido. La política de Control de aplicaciones de esta máquina lo bloquea.
- [ ] Generar y probar builds nativos de Android e iOS con las credenciales del proyecto. No se han creado cuentas, builds remotos ni publicaciones.

Los iconos de aplicación proceden de la plantilla oficial y son provisionales. Los temas de juego no usan recursos oficiales de Magic.
