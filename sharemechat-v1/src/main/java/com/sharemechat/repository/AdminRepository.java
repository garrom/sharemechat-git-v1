package com.sharemechat.repository;

import com.sharemechat.entity.Transaction;
import com.sharemechat.entity.PlatformTransaction;
import com.sharemechat.entity.Client;
import com.sharemechat.entity.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

import java.math.BigDecimal;
import java.util.List;

public interface AdminRepository extends Repository<Transaction, Long> {

    // Top modelos por ingresos (STREAM_EARNING)
    @Query("""
      select t.user.id as modelId, u.email, u.name, u.nickname, coalesce(sum(t.amount),0)
      from Transaction t
      join t.user u
      where t.operationType = 'STREAM_EARNING'
      group by t.user.id, u.email, u.name, u.nickname
      order by coalesce(sum(t.amount),0) desc
    """)
    List<Object[]> topModelsByEarnings(Pageable pageable);

    // Facturación bruta (suma de cargos a clientes; STREAM_CHARGE es negativa en tu modelo → se devolverá negativa)
    @Query("""
      select coalesce(sum(t.amount),0)
      from Transaction t
      where t.operationType = 'STREAM_CHARGE'
    """)
    BigDecimal sumGrossBilling();

    // Beneficio neto plataforma (márgenes)
    @Query("""
      select coalesce(sum(p.amount),0)
      from PlatformTransaction p
      where p.operationType = 'STREAM_MARGIN'
    """)
    BigDecimal sumNetProfit();

    // Top clientes por clients.totalPagos
    @Query("""
      select c.userId, u.email, u.name, u.nickname, coalesce(c.totalPagos,0)
      from Client c
      join User u on u.id = c.userId
      order by coalesce(c.totalPagos,0) desc
    """)
    List<Object[]> topClientsByTotalPagos(Pageable pageable);
}
