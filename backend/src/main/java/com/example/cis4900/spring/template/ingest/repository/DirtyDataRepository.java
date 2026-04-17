package com.example.cis4900.spring.template.ingest.repository;

import com.example.cis4900.spring.template.ingest.model.DirtyData;
import org.springframework.data.jpa.repository.JpaRepository;

//repository interface for DirtyData entity, extends JpaRepository to provide CRUD operations
public interface DirtyDataRepository extends JpaRepository<DirtyData, Long> {
    //inherits basic CRUD operations from JpaRepository
    //no additional methods needed for now
    //auto provided by JPA are save(), findById(), findAll(), deleteById(), etc.
}
