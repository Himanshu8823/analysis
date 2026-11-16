# Preferences (in Details)

The sources consulted during the construction of this project are listed below, grouped by discipline, with a note on what each was used for.

## Software Engineering and Modelling

**E. F. Codd, "A relational model of data for large shared data banks," Communications of the ACM, vol. 13, no. 6, pp. 377-387, June 1970.**
Used as the basis for the normalisation approach applied to the academic data model, and for the separation of the subject identity from its placement in a class context.

**R. Fielding and R. N. Taylor, "Architectural styles and the design of network-based software architectures," Ph.D. dissertation, University of California, Irvine, 2000.**
Used to justify the separation of the browser client, the application service and the data stores, and the choice of a stateless request interface between them.

**A. Silberschatz, H. F. Korth and S. Sudarshan, Database System Concepts, 7th ed. New York: McGraw-Hill Education, 2017.**
Used for the treatment of relational design, referential integrity, indexing strategy and the transaction guarantees relied upon when writing extracted marks.

**I. Jacobson et al., Unified Modeling Language (UML) Specification, Version 2.5.1, Object Management Group, December 2017.**
Used for the notation of the use case, class, sequence and activity diagrams presented in Chapters 3 and 4.

**G. Snelson, "Structured flowchart and program notation," Communications of the ACM, vol. 5, no. 3, pp. 164-165, March 1962.**
Used for the flowchart symbol set of the overall system flow presented in Figure 1.1.

## Frameworks and Application Architecture

**NestJS, "NestJS Documentation - Modules, Guards, Interceptors and Custom Providers." [Online]. Available: https://docs.nestjs.com/. [Accessed: 14-Nov.-2026].**
Used to establish the module encapsulation, guard and interceptor lifecycle that the permission-based access control of the system is built upon.

**Vercel Inc., "Next.js Documentation." [Online]. Available: https://nextjs.org/docs. [Accessed: 14-Nov.-2026].**
Used for the client-side routing, server rendering and data-fetching patterns of the responsive browser interface.

**A. Lombarte, M. Calmejane and J. Garcia, *Learning TypeScript: Programming Typescript*, 3rd ed. Sebastopol: O'Reilly Media, 2023.**
Used for the strict compiler configuration, the discriminated unions used for the scheme calculators, and the justification of a statically typed codebase in a rules-heavy domain.

## Databases and Data Access

**PostgreSQL Global Development Group, "PostgreSQL Documentation, Version 16." [Online]. Available: https://www.postgresql.org/docs/. [Accessed: 14-Nov.-2026].**
Used for the relational features relied upon by the data model, the compound unique constraints, the secondary indexes and the transaction semantics of the confirmed mark write.

**Prisma, "Prisma Documentation - Data Mapper, ORM and Query Builder." [Online]. Available: https://www.prisma.io/docs. [Accessed: 14-Nov.-2026].**
Used for the type-safe data access approach, the migration mechanism that preserves existing records, and the seeding of the reference configuration data.

## Security

**OWASP Foundation, "OWASP Top 10:2021 - The Ten Most Critical Web Application Security Risks." [Online]. Available: https://owasp.org/Top10/. [Accessed: 14-Nov.-2026].**
Used as the reference for the authentication, authorisation, injection, misconfiguration and logging controls applied to the system.

**OWASP Foundation, "OWASP Cheat Sheet Series - Password Storage, Session Management and File Upload." [Online]. Available: https://cheatsheetseries.owasp.org/. [Accessed: 14-Nov.-2026].**
Used for the adaptive password hashing, the token issue-and-rotation policy, and the validation of uploaded files by declared size, extension and file signature.

## Networking and Web Standards

**R. Fielding, J. Gettys, J. Mogul, H. Frystyk, L. Masinter, D. Raggett and T. Berners-Lee, "Hypertext Transfer Protocol (HTTP/1.1): RFC 2616," Internet Engineering Task Force, June 1999.**
Used for the request and response semantics, the status codes and the cache-control behaviour that the client and application service are designed against.

## Document Processing and Artificial Intelligence

**M. Chen, O. G. Okuyucu and S. J. Sim, "Efficient OCR for Text Recognition," in Proceedings of the 16th International Conference on Document Analysis and Recognition, pp. 1-10, 2021.**
Used to establish the recognition pipeline applied to scanned result statements and to justify the selection of a table-structure model for printed tabular content.

**Hugging Face, "Hugging Face Inference API Documentation." [Online]. Available: https://huggingface.co/docs/inference. [Accessed: 14-Nov.-2026].**
Used for the hosted model interface through which scanned result statements are read, and for the model selection by content hint used in the recognition service.

# References (in IEEE Format)

[1] E. F. Codd, "A relational model of data for large shared data banks," Commun. ACM, vol. 13, no. 6, pp. 377-387, Jun. 1970.

[2] R. Fielding and R. N. Taylor, "Architectural styles and the design of network-based software architectures," Ph.D. dissertation, Univ. of California, Irvine, 2000.

[3] A. Silberschatz, H. F. Korth and S. Sudarshan, Database System Concepts, 7th ed. New York, NY: McGraw-Hill Education, 2017.

[4] "Unified Modeling Language (UML) Specification, Version 2.5.1," Object Management Group, Dec. 2017.

[5] G. Snelson, "Structured flowchart and program notation," Commun. ACM, vol. 5, no. 3, pp. 164-165, Mar. 1962.

[6] NestJS, "NestJS Documentation - Modules, Guards, Interceptors and Custom Providers." [Online]. Available: https://docs.nestjs.com/. [Accessed: 14-Nov.-2026].

[7] Vercel Inc., "Next.js Documentation." [Online]. Available: https://nextjs.org/docs. [Accessed: 14-Nov.-2026].

[8] A. Lombarte, M. Calmejane and J. Garcia, Learning TypeScript: Programming Typescript, 3rd ed. Sebastopol, CA: O'Reilly Media, 2023.

[9] PostgreSQL Global Development Group, "PostgreSQL Documentation, Version 16." [Online]. Available: https://www.postgresql.org/docs/. [Accessed: 14-Nov.-2026].

[10] Prisma, "Prisma Documentation - Data Mapper, ORM and Query Builder." [Online]. Available: https://www.prisma.io/docs. [Accessed: 14-Nov.-2026].

[11] OWASP Foundation, "OWASP Top 10:2021 - The Ten Most Critical Web Application Security Risks." [Online]. Available: https://owasp.org/Top10/. [Accessed: 14-Nov.-2026].

[12] OWASP Foundation, "OWASP Cheat Sheet Series - Password Storage, Session Management and File Upload." [Online]. Available: https://cheatsheetseries.owasp.org/. [Accessed: 14-Nov.-2026].

[13] M. Chen, O. G. Okuyucu and S. J. Sim, "Efficient OCR for text recognition," in Proc. 16th Int. Conf. Document Analysis and Recognition, 2021, pp. 1-10.

[14] Hugging Face, "Hugging Face Inference API Documentation." [Online]. Available: https://huggingface.co/docs/inference. [Accessed: 14-Nov.-2026].

[15] R. Fielding, J. Gettys, J. Hoglund et al., "Hypertext Transfer Protocol (HTTP/1.1): RFC 2616," IETF, RFC 2616, Jun. 1999.
