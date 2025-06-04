/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.weatherapi.com',
        pathname: '/weather/64x64/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
  },

  // Proxy interno para sortear CORS al llamar a WeatherAPI desde el cliente
  async rewrites() {
    return [
      {
        source: '/api/weather/:path*',
        destination: 'https://api.weatherapi.com/v1/:path*',
      },
    ];
  },
};

export default nextConfig;