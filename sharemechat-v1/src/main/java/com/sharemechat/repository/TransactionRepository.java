package com.sharemechat.repository;

import com.sharemechat.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    @Query("""
        SELECT t.id
        FROM Transaction t
        WHERE NOT EXISTS (
            SELECT 1
            FROM Balance b
            WHERE b.transactionId = t.id
        )
    """)
    List<Long> findTransactionIdsWithoutBalance();
}
