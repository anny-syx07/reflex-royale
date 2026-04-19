import type { Metadata, Viewport } from "next";
import "./globals.css";

/**
 * 📚 KIẾN THỨC: layout.tsx
 *
 * Đây là "vỏ ngoài" bọc TẤT CẢ các trang.
 * Tương đương với phần <head> và <body> lặp lại trong mọi file HTML cũ.
 *
 * Thay vì copy-paste <link rel="stylesheet"> vào mọi file HTML,
 * bây giờ chỉ cần khai báo 1 lần ở đây.
 * 
 * metadata: Next.js tự động inject vào <head> cho SEO.
 */
export const metadata: Metadata = {
  title: "UMT Game Hub",
  description: "UMT's realtime gaming platform. Learn while you play!",
};

/**
 * 📚 KIẾN THỨC: Viewport export (Next.js 16+)
 *
 * Next.js 16 tách viewport ra export riêng thay vì để trong metadata.
 * Đây là pattern mới — Next.js phát triển liên tục nên API hay thay đổi nhỏ.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children, // children = nội dung của trang hiện tại
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        {/* Google Fonts — Press Start 2P cho pixel style */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* children sẽ được thay bằng nội dung page tương ứng */}
        {children}
      </body>
    </html>
  );
}
