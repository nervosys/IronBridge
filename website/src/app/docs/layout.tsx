import { Header, Sidebar } from '@/components/Nav';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Header />
            <div className="page-wrapper">
                <Sidebar />
                <main className="main-content">
                    {children}
                    <footer className="footer">
                        © {new Date().getFullYear()} Nervosys LLC — Apache 2.0 License
                    </footer>
                </main>
            </div>
        </>
    );
}
