package com.sharemechat.storage;

import org.apache.commons.imaging.Imaging;
import org.apache.commons.imaging.common.ImageMetadata;
import org.apache.commons.imaging.formats.jpeg.JpegImageMetadata;
import org.apache.commons.imaging.formats.jpeg.exif.ExifRewriter;
import org.apache.commons.imaging.formats.tiff.write.TiffOutputSet;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Cubre el flujo `store()` del storage local: validación de extensión,
 * magic-bytes por formato, tamaño y defensa contra path-traversal, MÁS la
 * integración del scrubber de EXIF (el punto exacto que se tocó al meter el
 * strip de metadatos). El scrubber tiene su propio test; aquí se verifica que
 * `store()` lo invoca de verdad y que persiste el fichero limpio.
 */
class LocalStorageServiceStoreTest {

    @TempDir
    Path root;

    private LocalStorageService svc;

    @BeforeEach
    void setUp() {
        svc = new LocalStorageService();
        ReflectionTestUtils.setField(svc, "root", root.toString());
        ReflectionTestUtils.setField(svc, "allowedExtensionsCsv", "jpg,jpeg,png,webp,gif,mp4,webm,pdf");
        ReflectionTestUtils.setField(svc, "maxFileSizeBytes", 26_214_400L);
        ReflectionTestUtils.setField(svc, "maxBaseNameLength", 80);
        ReflectionTestUtils.invokeMethod(svc, "init");
    }

    @Test
    void almacenaJpegYEliminaElExifGps() throws Exception {
        byte[] jpegConGps = jpegConGps();
        // sanity: el fixture entra con EXIF.
        assertThat(Imaging.getMetadata(jpegConGps)).isInstanceOf(JpegImageMetadata.class);
        assertThat(((JpegImageMetadata) Imaging.getMetadata(jpegConGps)).getExif()).isNotNull();

        MockMultipartFile f = new MockMultipartFile("file", "foto.jpg", "image/jpeg", jpegConGps);
        String url = svc.store(f, "models/1/profile");

        assertThat(url).startsWith("/uploads/models/1/profile/").endsWith(".jpg");
        Path stored = root.resolve(url.substring("/uploads/".length()));
        assertThat(Files.exists(stored)).isTrue();

        byte[] out = Files.readAllBytes(stored);
        // sigue siendo un JPEG decodificable...
        assertThat(ImageIO.read(new ByteArrayInputStream(out))).isNotNull();
        // ...pero sin EXIF.
        ImageMetadata meta = Imaging.getMetadata(out);
        if (meta instanceof JpegImageMetadata jm) {
            assertThat(jm.getExif()).as("el fichero almacenado no debe llevar EXIF/GPS").isNull();
        }
    }

    @Test
    void rechazaExtensionNoPermitida() {
        MockMultipartFile f = new MockMultipartFile("file", "malware.exe", "application/octet-stream",
                new byte[]{1, 2, 3, 4});
        assertThatThrownBy(() -> svc.store(f, "p"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Extension no permitida");
    }

    @Test
    void rechazaMagicBytesQueNoCasanLaExtension() {
        // extensión .png pero el contenido no es PNG.
        MockMultipartFile f = new MockMultipartFile("file", "fake.png", "image/png",
                new byte[]{0, 1, 2, 3, 4, 5, 6, 7, 8, 9});
        assertThatThrownBy(() -> svc.store(f, "p"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("PNG");
    }

    @Test
    void rechazaFicheroVacio() {
        MockMultipartFile f = new MockMultipartFile("file", "x.jpg", "image/jpeg", new byte[0]);
        assertThatThrownBy(() -> svc.store(f, "p")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rechazaFicheroDemasiadoGrande() throws Exception {
        ReflectionTestUtils.setField(svc, "maxFileSizeBytes", 8L); // umbral minúsculo
        MockMultipartFile f = new MockMultipartFile("file", "x.jpg", "image/jpeg", jpegConGps());
        assertThatThrownBy(() -> svc.store(f, "p"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("grande");
    }

    @Test
    void elPrefijoConTraversalNoEscapaDelRoot() throws Exception {
        // Los caracteres de traversal se sanean y el destino sigue bajo root.
        MockMultipartFile f = new MockMultipartFile("file", "x.jpg", "image/jpeg", jpegConGps());
        String url = svc.store(f, "../../etc");
        Path stored = root.resolve(url.substring("/uploads/".length())).normalize();
        assertThat(stored.startsWith(root)).as("el fichero no debe escapar del root de storage").isTrue();
    }

    /** JPEG mínimo con un bloque EXIF que incluye coordenadas GPS. */
    private static byte[] jpegConGps() throws Exception {
        BufferedImage img = new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream base = new ByteArrayOutputStream();
        ImageIO.write(img, "jpg", base);

        TiffOutputSet outputSet = new TiffOutputSet();
        outputSet.setGpsInDegrees(-3.70379, 40.41678);

        ByteArrayOutputStream withExif = new ByteArrayOutputStream();
        new ExifRewriter().updateExifMetadataLossless(base.toByteArray(), withExif, outputSet);
        return withExif.toByteArray();
    }
}
