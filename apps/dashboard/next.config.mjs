/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ['@codaya/db', '@codaya/agent'],
  // Le logo d'agence passe par une Server Action. Le plafond réel (500 Ko)
  // est vérifié dans l'action, qui peut alors afficher un message ; au-delà
  // de cette limite-ci, Next rejette la requête sans rien dire.
  experimental: { serverActions: { bodySizeLimit: '5mb' } },
  // @codaya/db importe avec des extensions `.js` qui pointent vers des
  // fichiers `.ts` (convention NodeNext) — sans cet alias, le webpack de
  // Next ne résout pas ces imports pour un package transpilé.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
    }
    return config
  },
}
