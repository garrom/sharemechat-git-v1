package com.sharemechat.jobs;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.Unsubscribe;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UnsubscribeRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.TransactionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

@Component
public class ClientForfeitJob {

    private static final Logger log = LoggerFactory.getLogger(ClientForfeitJob.class);

    private final UnsubscribeRepository unsubscribeRepository;
    private final UserRepository userRepository;
    private final TransactionService transactionService;

    public ClientForfeitJob(
            UnsubscribeRepository unsubscribeRepository,
            UserRepository userRepository,
            TransactionService transactionService
    ) {
        this.unsubscribeRepository = unsubscribeRepository;
        this.userRepository = userRepository;
        this.transactionService = transactionService;
    }

    /**
     * Ejecuta el forfeit diferido de clientes dados de baja
     * cuyo periodo de gracia ha expirado.
     *
     * Se ejecuta una vez al día a las 03:10.
     */
    @Scheduled(cron = "0 10 3 * * *")
    public void processClientForfeits() {

        LocalDate today = LocalDate.now();

        log.info("ClientForfeitJob: buscando clientes con forfeit_after <= {}", today);

        List<Unsubscribe> expired = unsubscribeRepository.findByForfeitAfterLessThanEqual(today);

        if (expired.isEmpty()) {
            log.info("ClientForfeitJob: no hay clientes pendientes de forfeit.");
            return;
        }

        log.info("ClientForfeitJob: encontrados {} registros para procesar.", expired.size());

        for (Unsubscribe row : expired) {

            Long userId = row.getUserId();

            try {

                User user = userRepository.findByIdForUpdate(userId)
                        .orElse(null);

                if (user == null) {
                    log.warn("ClientForfeitJob: usuario {} no encontrado", userId);
                    continue;
                }

                if (!Boolean.TRUE.equals(user.getUnsubscribe())) {
                    log.info("ClientForfeitJob: usuario {} ya no está dado de baja, se ignora", userId);
                    row.setForfeitAfter(null);
                    unsubscribeRepository.save(row);
                    continue;
                }

                log.info("ClientForfeitJob: ejecutando forfeit diferido para userId={}", userId);

                transactionService.forfeitOnUnsubscribe(
                        userId,
                        Constants.Roles.CLIENT,
                        "Forfeit diferido tras baja voluntaria (periodo de gracia expirado)"
                );

                row.setForfeitAfter(null);
                unsubscribeRepository.save(row);

                log.info("ClientForfeitJob: forfeit completado userId={}", userId);

            } catch (Exception ex) {

                log.error(
                        "ClientForfeitJob: error procesando userId={}: {}",
                        userId,
                        ex.getMessage(),
                        ex
                );
            }
        }

        log.info("ClientForfeitJob: ejecución completada.");
    }
}