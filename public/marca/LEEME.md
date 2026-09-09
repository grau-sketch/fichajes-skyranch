# Sello de la marca

Deja aquí el sello de Skyranch como **`logo.png`** (cuadrado, fondo
transparente o del color del sello, mínimo 512×512 px).

Después, en `lib/constants.ts`:

```ts
export const LOGO_SRC: string | null = '/marca/logo.png'
```

Con eso aparece en:

- la cabecera de todas las pantallas (`components/Marca.tsx`)
- la pantalla de acceso, en grande (`components/Sello.tsx`)

Y para que sea también el icono de la app instalada en el móvil, se regeneran
los iconos a partir de él:

```bash
python3 scripts/iconos.py
```

Mientras `logo.png` no esté, la app muestra el nombre escrito y un círculo con
las iniciales: nunca una imagen rota.
