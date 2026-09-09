"""Genera los iconos PNG de la PWA sin dependencias (zlib + struct).

Provisional: un reloj con los colores del sello. Cuando esté
`public/marca/logo.png`, los iconos saldrán del sello real.

    python3 scripts/iconos.py

Un reloj blanco sobre el color de marca. Si cambias --marca en globals.css,
cambia MARCA aquí y vuelve a ejecutarlo.
"""
import math
import struct
import zlib
from pathlib import Path

MARCA = (0x4A, 0x31, 0x21)   # marrón del sello Skyranch
BLANCO = (0xE8, 0xDD, 0xC4)  # tostado claro del sello
SALIDA = Path(__file__).resolve().parent.parent / "public" / "icons"


def mezclar(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def cobertura(f, x, y, muestras=3):
    """Antialiasing por supermuestreo en una rejilla de muestras x muestras."""
    dentro = 0
    paso = 1.0 / (muestras + 1)
    for i in range(1, muestras + 1):
        for j in range(1, muestras + 1):
            if f(x + i * paso, y + j * paso):
                dentro += 1
    return dentro / (muestras * muestras)


def dist_segmento(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    largo2 = dx * dx + dy * dy
    t = 0.0 if largo2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / largo2))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def render(tamano, margen_rel):
    """Devuelve las filas RGB del icono. margen_rel deja aire para maskable."""
    c = tamano / 2
    r = tamano * (0.5 - margen_rel)          # radio de la esfera
    grosor = max(1.0, tamano * 0.055)
    radio_esquina = tamano * 0.22

    ax_h = (c, c, c, c - r * 0.42)           # aguja de horas -> 9 en punto
    ax_m = (c, c, c + r * 0.30, c - r * 0.52)  # aguja de minutos -> 1 en punto

    def en_fondo(x, y):
        # Cuadrado redondeado a todo el lienzo.
        dx = max(abs(x - c) - (tamano / 2 - radio_esquina), 0)
        dy = max(abs(y - c) - (tamano / 2 - radio_esquina), 0)
        return math.hypot(dx, dy) <= radio_esquina

    def en_aro(x, y):
        return abs(math.hypot(x - c, y - c) - r) <= grosor / 2

    def en_agujas(x, y):
        return (
            dist_segmento(x, y, *ax_h) <= grosor * 0.46
            or dist_segmento(x, y, *ax_m) <= grosor * 0.42
        )

    filas = []
    for y in range(tamano):
        fila = bytearray()
        for x in range(tamano):
            fondo = cobertura(en_fondo, x, y)
            if fondo == 0:
                fila += bytes((0, 0, 0))  # transparente vía alfa aparte
                continue
            tinta = max(cobertura(en_aro, x, y), cobertura(en_agujas, x, y))
            color = mezclar(MARCA, BLANCO, tinta)
            fila += bytes(color)
        filas.append(bytes(fila))
    return filas


def alfa(tamano, margen_rel):
    c = tamano / 2
    radio_esquina = tamano * 0.22

    def en_fondo(x, y):
        dx = max(abs(x - c) - (tamano / 2 - radio_esquina), 0)
        dy = max(abs(y - c) - (tamano / 2 - radio_esquina), 0)
        return math.hypot(dx, dy) <= radio_esquina

    return [
        bytes(round(255 * cobertura(en_fondo, x, y)) for x in range(tamano))
        for y in range(tamano)
    ]


def escribir_png(ruta, tamano, margen_rel):
    rgb = render(tamano, margen_rel)
    a = alfa(tamano, margen_rel)
    cruda = bytearray()
    for y in range(tamano):
        cruda.append(0)  # filtro None
        fila = rgb[y]
        for x in range(tamano):
            cruda += fila[x * 3 : x * 3 + 3] + bytes((a[y][x],))

    def chunk(tipo, datos):
        return (
            struct.pack(">I", len(datos))
            + tipo
            + datos
            + struct.pack(">I", zlib.crc32(tipo + datos) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", tamano, tamano, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(cruda), 9))
    png += chunk(b"IEND", b"")
    ruta.write_bytes(png)
    print(f"  {ruta.name}  {tamano}x{tamano}  {len(png) / 1024:.1f} KB")


if __name__ == "__main__":
    SALIDA.mkdir(parents=True, exist_ok=True)
    print("Generando iconos:")
    escribir_png(SALIDA / "icono-192.png", 192, 0.10)
    escribir_png(SALIDA / "icono-512.png", 512, 0.10)
    # Maskable: el sistema recorta hasta un 20 %, así que dejamos más aire.
    escribir_png(SALIDA / "icono-maskable-512.png", 512, 0.20)
    escribir_png(SALIDA / "apple-touch-icon.png", 180, 0.0)
