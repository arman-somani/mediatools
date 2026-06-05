export default function PrivacyPage() {
    return (
        <main className="min-h-screen pt-32 px-6 text-white">
            <div className="max-w-5xl mx-auto glass-panel rounded-3xl p-8">
                <h1 className="text-5xl font-bold mb-8">Privacy Policy</h1>

                <div className="space-y-6 text-slate-300">
                    <p>
                        MediaTools stores account information required for login and
                        conversion history.
                    </p>

                    <p>
                        Uploaded files are temporarily stored and automatically removed.
                    </p>

                    <p>
                        We never sell user data to third parties.
                    </p>

                    <p>
                        Payment information is only used for subscription activation.
                    </p>
                </div>
            </div>
        </main>
    );
}