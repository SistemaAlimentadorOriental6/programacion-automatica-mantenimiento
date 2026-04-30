import { useState } from 'preact/hooks';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Mail01Icon,
    ViewIcon,
    ViewOffIcon,
    LockPasswordIcon,
    ArrowRight01Icon
} from '@hugeicons/core-free-icons';

export default function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await fetch('http://localhost:4000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok || !data.done) {
                setError(data.error || 'Credenciales incorrectas');
                setIsLoading(false);
                return;
            }

            // Guardar token y redirigir
            localStorage.setItem('token', data.data.token);
            window.location.href = '/dashboard';
        } catch {
            setError('No se pudo conectar con el servidor.');
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} class="space-y-5 animate-fade-in">
            {/* Campo Email */}
            <div class="group relative">
                <label class="block text-xs font-bold text-texto-grey uppercase tracking-widest mb-2">
                    Correo Electrónico
                </label>
                <div class="relative flex items-center">
                    <div class="absolute left-4 text-texto-grey transition-colors group-focus-within:text-primary z-10 pointer-events-none">
                        <HugeiconsIcon icon={Mail01Icon} size={18} />
                    </div>
                    <input
                        type="email"
                        value={email}
                        onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
                        placeholder="usuario@sao6.com.co"
                        required
                        class="w-full pl-11 pr-4 py-4 rounded-soft border border-gray-200 bg-fondo-soft/50 text-texto-dark placeholder-texto-grey/60 font-medium transition-all duration-300 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white"
                    />
                </div>
            </div>

            {/* Campo Contraseña */}
            <div class="group relative">
                <label class="block text-xs font-bold text-texto-grey uppercase tracking-widest mb-2">
                    Contraseña (NIT)
                </label>
                <div class="relative flex items-center">
                    <div class="absolute left-4 text-texto-grey transition-colors group-focus-within:text-primary z-10 pointer-events-none">
                        <HugeiconsIcon icon={LockPasswordIcon} size={18} />
                    </div>
                    <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                        placeholder="Tu número de NIT"
                        required
                        class="w-full pl-11 pr-12 py-4 rounded-soft border border-gray-200 bg-fondo-soft/50 text-texto-dark placeholder-texto-grey/60 font-medium transition-all duration-300 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        class="absolute right-4 text-texto-grey hover:text-primary transition-colors duration-200 z-10 hover:scale-110 active:scale-95"
                    >
                        <HugeiconsIcon icon={showPassword ? ViewOffIcon : ViewIcon} size={18} />
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div class="text-red-500 text-sm font-medium bg-red-50 border border-red-100 px-4 py-3 rounded-xl animate-slide-up">
                    {error}
                </div>
            )}

            {/* Botón Submit */}
            <button
                type="submit"
                disabled={isLoading}
                className={`group w-full py-4 px-8 bg-primary text-white font-semibold rounded-soft transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-[0px_10px_20px_-10px_rgba(76,194,83,0.5)] hover:-translate-y-1 hover:shadow-[0px_15px_25px_-10px_rgba(76,194,83,0.6)] active:translate-y-0 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3 mt-2`}
            >
                {isLoading ? (
                    <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : (
                    <>
                        <span>Iniciar Sesión</span>
                        <HugeiconsIcon
                            icon={ArrowRight01Icon}
                            size={20}
                            className="transition-transform duration-300 group-hover:translate-x-1"
                        />
                    </>
                )}
            </button>
        </form>
    );
}
