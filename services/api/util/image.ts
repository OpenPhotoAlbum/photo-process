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
    
    // Get metadata to determine bit depth
    const metadata = await s.metadata();
    const is16Bit = metadata.depth === 'ushort' || metadata.space?.includes('16');

    const { channels: [rc, gc, bc] } = await s.stats();

    // Normalize 16-bit values (0-65535) to 8-bit values (0-255)
    const normalize = (value: number) => {
        if (is16Bit) {
            return Math.round((value / 65535) * 255);
        }
        return Math.round(value);
    };

    const r = rc ? normalize(rc.mean) : 0;
    const g = gc ? normalize(gc.mean) : 0;
    const b = bc ? normalize(bc.mean) : 0;

    const dominantColor = rgbToHex(r,g,b);

    return dominantColor;
};
