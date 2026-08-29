package com.sharemechat.storage;

import org.apache.commons.imaging.Imaging;
import org.apache.commons.imaging.common.ImageMetadata;
import org.apache.commons.imaging.formats.jpeg.JpegImageMetadata;
import org.apache.commons.imaging.formats.jpeg.exif.ExifRewriter;
import org.apache.commons.imaging.formats.tiff.write.TiffOutputSet;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.assertj.core.api.Assertions.assertThat;

class ImageMetadataScrubberTest {

    @Test
    void handlesSoloJpeg() {
        assertThat(ImageMetadataScrubber.handles("jpg")).isTrue();
        assertThat(ImageMetadataScrubber.handles("JPEG")).isTrue();
        assertThat(ImageMetadataScrubber.handles("png")).isFalse();
        assertThat(ImageMetadataScrubber.handles("mp4")).isFalse();
        assertThat(ImageMetadataScrubber.handles(null)).isFalse();
    }

    @Test
    void scrubDevuelveOriginalSiNoAplica() {
        byte[] png = new byte[] {1, 2, 3, 4};
        assertThat(ImageMetadataScrubber.scrub(png, "png")).isSameAs(png);
        assertThat(ImageMetadataScrubber.scrub(null, "jpg")).isNull();
        byte[] vacio = new byte[0];
        assertThat(ImageMetadataScrubber.scrub(vacio, "jpg")).isSameAs(vacio);
    }

    @Test
    void quitaElExifGpsDeUnJpeg() throws Exception {
        byte[] jpegConGps = jpegConGps();

        // Antes: el JPEG tiene EXIF.
        ImageMetadata metaAntes = Imaging.getMetadata(jpegConGps);
        assertThat(metaAntes).isInstanceOf(JpegImageMetadata.class);
        assertThat(((JpegImageMetadata) metaAntes).getExif())
                .as("el fixture debe llevar EXIF/GPS antes de limpiar")
                .isNotNull();

        // Scrub.
        byte[] limpio = ImageMetadataScrubber.scrub(jpegConGps, "jpg");

        // Después: sigue siendo un JPEG válido decodificable, sin EXIF.
        assertThat(ImageIO.read(new java.io.ByteArrayInputStream(limpio)))
                .as("el JPEG limpio sigue siendo decodificable")
                .isNotNull();
        ImageMetadata metaDespues = Imaging.getMetadata(limpio);
        if (metaDespues instanceof JpegImageMetadata jpegMeta) {
            assertThat(jpegMeta.getExif())
                    .as("tras limpiar no debe quedar EXIF/GPS")
                    .isNull();
        }
        // (si metaDespues es null, tampoco hay EXIF: correcto)
    }

    /** Construye un JPEG mínimo con un bloque EXIF que incluye coordenadas GPS. */
    private static byte[] jpegConGps() throws Exception {
        BufferedImage img = new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream baseOut = new ByteArrayOutputStream();
        ImageIO.write(img, "jpg", baseOut);
        byte[] base = baseOut.toByteArray();

        TiffOutputSet outputSet = new TiffOutputSet();
        outputSet.setGpsInDegrees(-3.70379, 40.41678); // Madrid, lon/lat

        ByteArrayOutputStream withExif = new ByteArrayOutputStream();
        new ExifRewriter().updateExifMetadataLossless(base, withExif, outputSet);
        return withExif.toByteArray();
    }
}
