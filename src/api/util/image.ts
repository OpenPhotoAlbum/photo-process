import sharp, { SharpInput } from 'sharp';

export const Image = (imagePath: SharpInput) => sharp(imagePath).withMetadata();

export const dominantColorFromImage = async (imagepath: string): Promise<string> => {
    function rgbToHex(r: number, g: number, b: number) {
        return "#" + [r, g, b].map(x => {
          const hex = x.toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        }).join("");
    }

    const s = Image(imagepath);

    const { channels: [rc, gc, bc] } = await s.stats();

    const r = rc ? Math.round(rc.mean) : 0;
    const g = gc ? Math.round(gc.mean) : 0;
    const b = bc ? Math.round(bc.mean) : 0;

    const dominantColor = rgbToHex(r,g,b);

    return dominantColor;
};
