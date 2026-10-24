# Result Analysis System - Project Rules

## Project Context

## 🎨 Design System (CRITICAL)

- **Source of Truth**: `npx getdesign@latest add coinbase`
- **Strict Rule**: ONLY use colors, components, and design tokens from this design system
- **NEVER introduce new colors, custom components, or design elements outside this system**
- All UI components must come from the design system library
- Any deviation requires explicit approval

## 📱 Responsiveness (CRITICAL)

All UI code MUST be responsive across exactly 3 breakpoints:

- **Mobile**: `< 768px` (default Tailwind: default styles)
- **Tablet**: `768px - 1023px` (md breakpoint)
- **Desktop**: `>= 1024px` (lg breakpoint)

**Rules:**

- Every component, page, and layout must work flawlessly on all 3 sizes
- Test mentally for mobile/tablet/desktop before writing code
- Use Tailwind responsive prefixes (default / md: / lg:)
- Tables, charts, forms, navigation - everything responsive
- Charts must adapt: stacked layout on mobile, side-by-side on desktop
- Modals: full-screen on mobile, centered dialog on desktop
- Navigation: hamburger menu on mobile, full sidebar on desktop
- No horizontal scroll on any breakpoint
- Touch-friendly targets on mobile (min 44px)

## 🔴 Strict Rules (User Defined - MUST FOLLOW)

### 1. Complete Implementation

- 100% implementation required, no shortcuts
- NEVER assume something is completed without verifying the actual code
- Every feature must be fully functional with all edge cases handled
- Partial implementations are NOT acceptable

### 2. Code is the Source of Truth

- Code should be the source of truth, not memory
- In case of merge conflicts, rely on actual code, not assumptions
- Always check current code state before making decisions
- Documentation should match actual implementation

### 3. Proper Thinking + Correct Architecture

- Think deeply before coding
- Use correct architecture, not temporary solutions
- Every solution should be permanent, not quick-fixes
- Design patterns should be applied properly where needed
- Consider scalability, maintainability, security from day one

### 4. Coding Standards (Compulsory)

- Coding standards are mandatory, not optional
- Follow language-specific best practices
- Consistent naming conventions across the entire codebase
- Proper file/folder organization
- Comments where needed but code should be self-explanatory
- No dead code, no commented-out code

### 5. Efficient Caching + Real-world Rate Limiting

**Caching Strategy:**

- Use efficient caching on both sides (React Query on frontend, Redis on backend)
- Cache invalidations must be done properly (stale-while-revalidate, etc.)
- Different cache strategies for different data types
- Cache TTL based on data volatility

**Rate Limiting:**

- Implement rate limiting properly
- DON'T go for AI-like limiting first
- Study how real systems use rate limiting (GitHub, Stripe, AWS patterns)
- User convenience should NOT be compromised
- Different limits for different operations (upload, download, API calls)
- Graceful degradation when limits hit

### 6. No Temporary Fixes

- Temporary fixes are NOT acceptable
- Every fix must be a permanent workaround
- Root cause analysis before fixing
- No `// TODO: fix this later` type of code
- If something needs refactoring, refactor it immediately

### 7. Strong RBAC + Security Guidelines

**RBAC (Role-Based Access Control):**

- Strong RBAC implementation mandatory
- Permission-based access, not just role-based
- Principle of least privilege
- Every action must be authorized
- Multi-level access (Super Admin, Admin, Teacher, HOD, Principal)

**Security:**

- OWASP top 10 protection
- SQL injection prevention (use parameterized queries)
- XSS protection (sanitize inputs)
- CSRF protection
- Input validation both client and server side
- Encrypted passwords (bcrypt/argon2)
- JWT tokens with proper expiry
- HTTPS only in production
- File upload security (type validation, size limits, virus scanning)

### 8. Strict Frontend Optimization (Without Quality Loss)

**Performance Optimization:**

- Code splitting and lazy loading
- Memoization where appropriate
- Virtual rendering for large lists
- Image optimization
- Bundle size optimization
- CDN usage for static assets
- Gzip/Brotli compression

**Quality Preservation:**

- Optimizations should NEVER compromise UX
- Accessibility must be maintained (WCAG 2.1 AA)
- Responsive design (mobile, tablet, desktop)
- Loading states for all async operations
- Error states with retry options
- Optimistic updates where safe
- No layout shifts (CLS optimization)
- Lighthouse score: 90+ in all categories

---

## 🟢 Additional Best Practices (Claude Recommended)

### Code Organization

- Clear separation: authentication, permissions, business logic, UI
- MVC/Service-Repository pattern where applicable
- Configuration via environment variables (`.env`), no hard-coded values
- Monorepo or modular structure for scalability

### Error Handling

- Proper error handling in every function
- User-friendly error messages (no technical jargon to users)
- Detailed error logs for debugging
- Critical operations in transactions
- Global error boundary in frontend

### Testing

- Unit tests for critical business logic
- Integration tests for APIs
- Security/authorization tests
- Performance tests for file upload and report generation
- E2E tests for key user flows
- Aim for 80%+ code coverage on critical paths

### Documentation

- Every function/component has clear purpose
- README.md with setup instructions
- API documentation (Swagger/OpenAPI)
- Architecture decision records (ADR)
- Inline comments for complex logic

### Database Design

- Proper migrations (never modify existing migrations)
- Indexes for performance (roll_no, subject_code)
- Soft deletes (audit trail)
- Backups strategy
- Foreign key constraints
- Normalized schema (avoid data redundancy)

### Logging &amp; Monitoring

- User actions audit log (who, what, when, why)
- System errors log
- Performance metrics tracking
- Alerts for critical failures
- Daily log rotation

### Scalability

- Horizontal scaling support
- Heavy operations asynchronous (report generation)
- Large file uploads via streaming
- Database query optimization (avoid N+1)
- Connection pooling
- Queue system for background jobs (Redis/RabbitMQ)

### UI/UX Standards

- Consistent design system
- Loading states for all async ops
- Error states with retry options
- Success notifications
- Mobile responsive (mobile-first approach)
- Accessibility (keyboard navigation, screen reader support)
- Dark mode support
- Internationalization ready (future scope)

---

## 🔄 Development Workflow

### Before Starting Any Feature:

1. **Think deeply** about the architecture
2. **Plan first**, code later
3. **Design data flow** before implementation
4. **Consider edge cases** upfront
5. **Write tests alongside** code

### During Implementation:

1. **Follow coding standards** strictly
2. **Write clean, readable code**
3. **Add proper error handling**
4. **Implement security from day one**
5. **Optimize as you go**, not later

### After Implementation:

1. **Test thoroughly** (unit + integration + manual)
2. **Code review** (self-review first)
3. **Update documentation**
4. **Verify performance** benchmarks
5. **Security audit** for new features

---

## 🎯 Project Goals

### Primary Goals:

- 100% accurate marks calculation
- Fast report generation (&lt; 2 minutes for 100 students)
- Secure access control (RBAC)
- User-friendly interface
- Mobile responsive design
- Production-ready quality

### Non-Negotiable:

- NO temporary solutions
- NO shortcuts on security
- NO quality compromise for speed
- NO incomplete features in releases

### Quality Metrics:

- Code coverage: 80%+ on critical paths
- Lighthouse score: 90+ all categories
- API response time: &lt; 200ms (95th percentile)
- Zero critical security vulnerabilities
- Zero data calculation errors

---

## 💡 Key Reminders

- **Every feature is production-ready**, not demo
- **Security is not an afterthought**, it's built-in
- **Performance + Quality together**, not either/or
- **User experience matters**, not just functionality
- **Documentation is part of code**, not optional

---

