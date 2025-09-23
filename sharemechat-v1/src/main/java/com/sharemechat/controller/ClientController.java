package com.sharemechat.controller;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.ClientDTO;
import com.sharemechat.entity.ClientDocument;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ClientDocumentRepository;
import com.sharemechat.service.ClientService;
import com.sharemechat.service.UserService;
import com.sharemechat.storage.StorageService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api/clients")
public class ClientController {

    private final ClientService clientService;
    private final UserService userService;
    private final ClientDocumentRepository clientDocumentRepository;
    private final StorageService storageService;

    public ClientController(ClientService clientService,
                            UserService userService,
                            ClientDocumentRepository clientDocumentRepository,
                            StorageService storageService) {
        this.clientService = clientService;
        this.userService = userService;
        this.clientDocumentRepository = clientDocumentRepository;
        this.storageService = storageService;
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMyClientInfo(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }

        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }

        // Solo clientes “definitivos” pueden consultar este endpoint
        if (!Constants.Roles.CLIENT.equals(user.getRole())) {
            // Si prefieres 200 con saldo 0, cambia por clientService.emptyDTO(user.getId()).
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Requiere rol CLIENT");
        }

        ClientDTO dto = clientService.getClientDTO(user);
        return ResponseEntity.ok(dto);
    }


    @GetMapping("/documents/me")
    public ResponseEntity<?> getMyClientDocuments(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }
        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }
        if (!Constants.Roles.CLIENT.equals(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Requiere rol CLIENT");
        }

        ClientDocument doc = clientDocumentRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    ClientDocument d = new ClientDocument();
                    d.setUserId(user.getId());
                    d.setUrlPic(null);
                    return d;
                });

        return ResponseEntity.ok(new ClientDocResponse(doc.getUrlPic()));
    }

    @PostMapping(value = "/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadMyClientPicture(
            Authentication authentication,
            @RequestPart(name = "pic", required = true) MultipartFile pic
    ) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }
        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }
        if (!Constants.Roles.CLIENT.equals(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Requiere rol CLIENT");
        }
        if (pic == null || pic.isEmpty()) {
            return ResponseEntity.badRequest().body("Archivo 'pic' vacío");
        }
        if (pic.getContentType() != null && !pic.getContentType().startsWith("image/")) {
            return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).body("Solo se aceptan imágenes");
        }

        try {
            // 1) Subir nuevo archivo
            String keyPrefix = "clients/" + user.getId();
            String newUrl = storageService.store(pic, keyPrefix);

            // 2) Persistir/crear doc y capturar la URL anterior
            ClientDocument doc = clientDocumentRepository.findByUserId(user.getId())
                    .orElseGet(() -> {
                        ClientDocument d = new ClientDocument();
                        d.setUserId(user.getId());
                        return d;
                    });
            String oldUrl = doc.getUrlPic();
            doc.setUrlPic(newUrl);
            clientDocumentRepository.save(doc);

            // 3) Borrar la imagen anterior (best-effort)
            try {
                storageService.deleteByPublicUrl(oldUrl);
            } catch (Exception ignore) {}

            return ResponseEntity.ok(new ClientDocResponse(doc.getUrlPic()));
        } catch (IOException io) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error almacenando el archivo");
        }
    }

    @DeleteMapping("/documents/pic")
    public ResponseEntity<?> deleteMyClientPicture(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }
        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }
        if (!Constants.Roles.CLIENT.equals(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Requiere rol CLIENT");
        }

        ClientDocument doc = clientDocumentRepository.findByUserId(user.getId()).orElse(null);
        if (doc == null || doc.getUrlPic() == null) {
            return ResponseEntity.noContent().build();
        }

        String oldUrl = doc.getUrlPic();
        doc.setUrlPic(null);
        clientDocumentRepository.save(doc);

        try {
            storageService.deleteByPublicUrl(oldUrl);
        } catch (Exception ignore) {}

        return ResponseEntity.noContent().build();
    }

    // Alias para soportar DELETE /api/clients/documents (frontend legacy)
    @DeleteMapping("/documents")
    public ResponseEntity<?> deleteMyClientDocumentsAlias(org.springframework.security.core.Authentication authentication) {
        return deleteMyClientPicture(authentication);
    }


    private record ClientDocResponse(String urlPic) {}
}
