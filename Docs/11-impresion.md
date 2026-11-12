# 11 — Especificación de impresión

> ⚠️ **IMPORTANTE — REGLA DEL PROYECTO:** No se escribe ninguna línea de código hasta que esta documentación esté terminada y aprobada. La documentación vive en `Docs/` en formato `.md` y **se actualiza cada vez que se hace un cambio**. Registra cada cambio en el [Control de cambios](README.md#control-de-cambios).

## 1. Principios
1. **Imprime el dispositivo que origina el documento**, por su ruta directa configurada (ADR-003). Si no tiene ruta directa, delega al hub de impresión vía servidor (solo con internet).
2. El documento se genera **en el navegador**: ESC/POS con `@point-of-sale/receipt-printer-encoder`, o XML ePOS para impresoras Epson por red.
3. Encabezado, pie, logo, ancho de papel y opciones son **configuración** (`ticket_templates`), nunca texto fijo.
4. Cada impresión se registra (tipo, documento, dispositivo, impresora, resultado) y se guarda en `print_jobs` local para reimprimir sin servidor.
5. Caracteres: página de códigos configurable por impresora (por defecto CP858/CP850 para ñ, á, é, í, ó, ú, ü, ¿, ¡). El encoder translitera lo que la impresora no soporte.

## 2. Ancho de papel

| Papel | Ancho imprimible | Columnas (Fuente A 12×24) | Columnas (Fuente B 9×17) |
|---|---|---|---|
| 80 mm | 72 mm (576 puntos) | **48** | 64 |
| 58 mm | 48 mm (384 puntos) | **32** | 42 |

Los ejemplos de abajo usan Fuente A. Los textos largos se ajustan con salto de línea con sangría.

## 3. Transportes

| Transporte | Dispositivo | Configuración | Notas |
|---|---|---|---|
| `epos-lan` | Cualquiera (incluido iPhone) en la red local | IP fija de la impresora, HTTPS habilitado en la impresora, certificado aceptado una vez en cada dispositivo | Recomendado para cocina |
| `webusb` | Android Chrome; Windows con driver WinUSB | Elegir dispositivo USB (vendor/product) | Permiso del navegador una vez |
| `webserial` | Windows/Linux/macOS Chrome/Edge | Puerto y baudios | |
| `webbluetooth` | Android/Windows Chrome (BLE) | Servicio/característica BLE de la impresora | Solo impresoras BLE |
| `qz` | PC de caja con QZ Tray | Nombre de impresora en QZ | Agente instalado y certificado de firma |
| `delegate` | Cualquiera, con internet | Hub de la sucursal (`print.request`) | Contingencia, no ruta principal |

**Estado de la impresora:** antes de imprimir se verifica disponibilidad (ePOS devuelve estado: sin papel, tapa abierta, fuera de línea). Si falla: 2 reintentos (1 s, 3 s) → aviso "No se imprimió <documento> — Reintentar / Imprimir en otra / Omitir". Omitir queda registrado.

## 4. Documentos

### 4.1 Comanda de cocina
**Dispara:** enviar a cocina (cada ronda), cancelación de ítems enviados (comanda de cancelación), reimpresión.
**Contenido:** número de orden (folio), mesa o "PARA LLEVAR" + nombre, mesero, hora de envío, comensales, "ADICIONAL" en rondas ≥ 2, ítems con cantidad en grande, modificadores sangrados, notas resaltadas, componentes de combo. **Sin precios.** Orden de los ítems: el del carrito (o por categoría si se configura). Sonido/zumbador de la impresora opcional.

**80 mm**
```
================================================
                  ** COMANDA **
                    ADICIONAL
================================================
ORDEN: C-000131            (M3-0005)
MESA: 5  · Salón            Comensales: 4
Mesero: Luis Pérez
Enviado: 11/11/2026 18:04       Ronda: 2
------------------------------------------------
2  LOMITO
     > Término: Medio
     > Extra queso
     *** NOTA: sin cebolla ***
1  PEPIÁN DE POLLO
     > Arroz blanco
1  COMBO ALMUERZO
     - Pollo a la plancha
     - Limonada natural
       > Sin azúcar
------------------------------------------------
Ítems: 4
================================================
```

**58 mm**
```
================================
          ** COMANDA **
            ADICIONAL
================================
ORDEN: C-000131
(M3-0005)
MESA: 5 · Salón     Pers: 4
Mesero: Luis Pérez
11/11/2026 18:04   Ronda 2
--------------------------------
2  LOMITO
   > Término: Medio
   > Extra queso
   *** sin cebolla ***
1  PEPIÁN DE POLLO
   > Arroz blanco
1  COMBO ALMUERZO
   - Pollo a la plancha
   - Limonada natural
     > Sin azúcar
--------------------------------
Ítems: 4
================================
```

**Para llevar (80 mm, encabezado)**
```
================================================
                  ** COMANDA **
           >>>>>  PARA LLEVAR  <<<<<
================================================
ORDEN: C-000132
Cliente: Sra. López   Tel: 5555-1234
Tomó: Ana Gómez (Caja 1)
Enviado: 11/11/2026 18:06
------------------------------------------------
```

**Comanda de cancelación (80 mm)**
```
================================================
        !!!  CANCELACIÓN  !!!
================================================
ORDEN: C-000131      MESA: 5
Cancelado: 18:12 por Luis Pérez
Autorizó: María Ruiz (Gerente)
Motivo: Cliente cambió de opinión
------------------------------------------------
-1  LOMITO
     > Término: Medio
================================================
```

### 4.2 Pre-cuenta
**Dispara:** botón "Pre-cuenta". **No** es comprobante de pago; lo dice explícitamente.
**Contenido:** logo (opcional), encabezado configurado, mesa, cuenta, mesero, comensales, fecha/hora, ítems con precio, descuentos, total, propina sugerida, total con propina, QR para cobro offline (ver doc 09 §6.2), pie.

**80 mm**
```
              [LOGO]
           RESTAURANTE EJEMPLO
        6a Avenida 1-23, Zona 1
           Tel. 2222-3333
================================================
                  PRE-CUENTA
         *** NO ES COMPROBANTE DE PAGO ***
------------------------------------------------
Mesa: 5            Cuenta: 1 de 2 (Ana)
Mesero: Luis Pérez          Comensales: 2
11/11/2026 19:20
------------------------------------------------
Cant Descripción                       Importe
------------------------------------------------
 2   Lomito                            Q190.00
       Término medio, Extra queso
 1   Pepián de pollo                    Q65.00
 2   Limonada natural                   Q30.00
------------------------------------------------
Subtotal                               Q285.00
Descuento (Cliente frecuente 10%)      -Q28.50
                                    ----------
TOTAL                                  Q256.50
Propina sugerida (10%)                  Q25.65
                                    ----------
TOTAL CON PROPINA                      Q282.15
------------------------------------------------
     La propina es voluntaria.
                 [QR]
           Folio: C-000131
          ¡Gracias por su visita!
================================================
```

**58 mm**
```
         [LOGO]
   RESTAURANTE EJEMPLO
  6a Avenida 1-23, Zona 1
     Tel. 2222-3333
================================
           PRE-CUENTA
 *** NO ES COMPROBANTE DE PAGO ***
--------------------------------
Mesa 5 · Cuenta 1/2 (Ana)
Mesero: Luis Pérez   Pers: 2
11/11/2026 19:20
--------------------------------
2 Lomito               Q190.00
  Término medio, Extra queso
1 Pepián de pollo       Q65.00
2 Limonada natural      Q30.00
--------------------------------
Subtotal               Q285.00
Desc. Cliente frec 10% -Q28.50
TOTAL                  Q256.50
Propina sug. (10%)      Q25.65
TOTAL C/PROPINA        Q282.15
--------------------------------
  La propina es voluntaria.
            [QR]
       Folio: C-000131
    ¡Gracias por su visita!
================================
```

### 4.3 Recibo
**Dispara:** al confirmar el pago (automático según `auto_print_receipt`) o reimpresión (`bill.reprint`, marcado "REIMPRESIÓN").
**Contenido:** encabezado, NIT del restaurante, folio del recibo, fecha/hora, mesa/para llevar, cajero, mesero, ítems, descuentos, total, propina, métodos de pago con referencia, efectivo recibido, cambio, NIT/nombre del cliente o "CF", leyenda configurable "Este documento no es factura" (mientras no exista FEL), pie.

**80 mm**
```
              [LOGO]
           RESTAURANTE EJEMPLO
     Restaurante Ejemplo, S.A. · NIT 1234567-8
        6a Avenida 1-23, Zona 1
================================================
                    RECIBO
------------------------------------------------
Recibo: C-R-000088         11/11/2026 19:31
Mesa: 5 · Cuenta 1 (Ana)   Orden: C-000131
Cajero: Ana Gómez          Mesero: Luis Pérez
Cliente: CF
------------------------------------------------
Cant Descripción                       Importe
------------------------------------------------
 2   Lomito                            Q190.00
 1   Pepián de pollo                    Q65.00
 2   Limonada natural                   Q30.00
------------------------------------------------
Subtotal                               Q285.00
Descuento                              -Q28.50
Propina                                 Q25.65
================================================
TOTAL PAGADO                           Q282.15
================================================
Tarjeta  (Ref. 004512)                 Q150.00
Efectivo                               Q200.00
Cambio                                  Q67.85
------------------------------------------------
  Precios incluyen impuestos.
  Este documento no es una factura.
          ¡Gracias por su visita!
================================================
```

**58 mm**
```
         [LOGO]
   RESTAURANTE EJEMPLO
 Restaurante Ejemplo, S.A.
     NIT 1234567-8
================================
            RECIBO
--------------------------------
Recibo: C-R-000088
11/11/2026 19:31
Mesa 5 · Cta 1 · Ord C-000131
Cajero: Ana G. Mesero: Luis P.
Cliente: CF
--------------------------------
2 Lomito               Q190.00
1 Pepián de pollo       Q65.00
2 Limonada natural      Q30.00
--------------------------------
Subtotal               Q285.00
Descuento              -Q28.50
Propina                 Q25.65
================================
TOTAL PAGADO           Q282.15
================================
Tarjeta (Ref 004512)   Q150.00
Efectivo               Q200.00
Cambio                  Q67.85
--------------------------------
Precios incluyen impuestos.
No es factura.
   ¡Gracias por su visita!
================================
```

### 4.4 Corte de caja
**Dispara:** al cerrar el turno; reimpresión desde Caja › Turnos.
**Contenido:** caja, sucursal, cajero que abrió y que cerró, horas, fondo inicial, ventas por método, propinas, retiros, depósitos, anulaciones, efectivo esperado, contado, diferencia, conteo por denominación (si se hizo), número de cuentas, descuentos y cancelaciones del turno, firmas.

**80 mm**
```
================================================
               CORTE DE CAJA
            RESTAURANTE EJEMPLO
              Sucursal Centro
================================================
Caja: Caja 1                Turno: #0045
Abrió: Ana Gómez       11/11/2026 10:58
Cerró: Ana Gómez       11/11/2026 23:12
------------------------------------------------
VENTAS POR MÉTODO                 Nº    Monto
Efectivo                          38 Q4,215.50
Tarjeta                           27 Q5,980.00
Transferencia                      4   Q620.00
                                    ----------
Total cobrado                     69 Q10,815.50
  de lo cual propinas                  Q842.30
------------------------------------------------
EFECTIVO
Fondo inicial                          Q500.00
+ Cobros en efectivo (neto)          Q4,215.50
+ Depósitos (1)                        Q200.00
- Retiros (2)                          Q650.00
- Reversos por anulación (1)            Q85.00
                                    ----------
= Efectivo esperado                  Q4,180.50
  Efectivo contado                   Q4,170.00
                                    ----------
  DIFERENCIA                           -Q10.50
Comentario: Faltante por cambio
------------------------------------------------
CONTEO                       Cant      Monto
Q200                            8  Q1,600.00
Q100                           15  Q1,500.00
Q50                            12    Q600.00
...
------------------------------------------------
Cuentas pagadas: 69    Anuladas: 1 (Q85.00)
Descuentos: 6 (Q312.00)
Cancelaciones de ítems: 4 (Q210.00)
Ventas netas (sin propina): Q9,973.20
------------------------------------------------


_______________        _______________
  Cajero                 Gerente
================================================
```

**58 mm** (mismo contenido, columnas reducidas)
```
================================
         CORTE DE CAJA
      RESTAURANTE EJEMPLO
        Sucursal Centro
================================
Caja 1 · Turno #0045
Abrió: Ana G.  11/11 10:58
Cerró: Ana G.  11/11 23:12
--------------------------------
POR MÉTODO        Nº     Monto
Efectivo          38 Q4,215.50
Tarjeta           27 Q5,980.00
Transferencia      4   Q620.00
Total            69 Q10,815.50
 Propinas              Q842.30
--------------------------------
Fondo inicial          Q500.00
+ Efectivo           Q4,215.50
+ Depósitos            Q200.00
- Retiros              Q650.00
- Reversos              Q85.00
= Esperado           Q4,180.50
  Contado            Q4,170.00
  DIFERENCIA           -Q10.50
--------------------------------
Cuentas: 69  Anuladas: 1
Desc.: 6 (Q312.00)
Cancel.: 4 (Q210.00)
Ventas netas: Q9,973.20
--------------------------------


____________  ____________
   Cajero       Gerente
================================
```

### 4.5 Otros impresos
| Documento | Contenido |
|---|---|
| Comprobante de retiro/depósito | Tipo, monto, motivo, usuario, autorizador, hora, firma |
| Página de prueba | Dispositivo, impresora, transporte, ancho, tabla de caracteres especiales (ñ á é í ó ú ü ¿ ¡ Q) |
| Reporte X (resumen parcial del turno, sin cerrar) | Igual al corte sin conteo ni diferencia `[SUPUESTO — F2]` |

## 5. Cajón de dinero
Se abre con el comando ESC/POS de pulso (`ESC p`) al imprimir un recibo con pago en efectivo, si la impresora de caja tiene `drawer_kick = true`. Apertura sin venta requiere `cash.open_drawer` y queda en bitácora.

## 6. Plantilla configurable
| Opción | Valores |
|---|---|
| `show_logo` | sí/no (logo convertido a mapa de bits monocromo, máx. 384/576 px de ancho) |
| `header`, `footer` | Texto multilínea con variables `{sucursal}`, `{direccion}`, `{telefono}`, `{nit}`, `{razon_social}`, `{fecha}`, `{mesero}` |
| `font_size_items` | normal / doble alto / doble ancho (comanda: doble alto por defecto) |
| `show_prices` | Solo pre-cuenta y recibo |
| `group_by_category` | Comanda |
| `copies` | Por ruta de dispositivo |
| `cut` | Corte total/parcial/ninguno |
| `beep` | Zumbador en comanda |
| `legend_not_invoice` | Texto "no es factura" (configurable por país/cliente) |
