export default () => ({
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.REFRESH_SECRET ?? 'change-me-in-production',
    refreshExpiresIn: process.env.REFRESH_EXPIRES_IN ?? '7d',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
  },
});