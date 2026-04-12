# ADR-001: Superficie dual en una sola app React

## Estado

Aprobada y en uso.

## Contexto

El producto y el backoffice comparten gran parte de la base técnica, pero deben presentarse como superficies distintas.

## Decisión

Mantener una sola aplicación React con dos superficies de build y routing condicional.

## Consecuencias

- reduce duplicación de frontend
- simplifica reutilización de componentes y sesión
- aumenta el acoplamiento a configuración de entorno y superficie
- exige mayor disciplina documental para separar producto y backoffice
