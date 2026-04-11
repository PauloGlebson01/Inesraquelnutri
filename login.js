import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAmodWGagSV-yco1FQ1-U81Xhd-y4NsE3s",
  authDomain: "ines-raquel-softclick-nutri.firebaseapp.com",
  projectId: "ines-raquel-softclick-nutri",
  storageBucket: "ines-raquel-softclick-nutri.firebasestorage.app",
  messagingSenderId: "284677746064",
  appId: "1:284677746064:web:4daac55dd6b2491dbd9715",
  measurementId: "G-5C0YC43V2G"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Aguardar o DOM carregar completamente
document.addEventListener('DOMContentLoaded', () => {
    // Elementos do DOM
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('senha');
    const btnLogin = document.getElementById('btnLogin');
    const loginErro = document.getElementById('loginErro');

    // Função para mostrar mensagem de erro
    function mostrarErro(mensagem) {
        if (loginErro) {
            loginErro.textContent = mensagem;
            loginErro.style.display = 'block';
            
            setTimeout(() => {
                if (loginErro) {
                    loginErro.style.display = 'none';
                }
            }, 5000);
        }
    }

    // Função para limpar erro
    function limparErro() {
        if (loginErro) {
            loginErro.style.display = 'none';
            loginErro.textContent = '';
        }
    }

    // Função para mostrar loading no botão
    function setLoading(loading) {
        if (btnLogin) {
            if (loading) {
                btnLogin.disabled = true;
                btnLogin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
            } else {
                btnLogin.disabled = false;
                btnLogin.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Entrar';
            }
        }
    }

    // Verificar se já está logado
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("Usuário já autenticado:", user.email);
            // Redirecionar para o dashboard
            window.location.href = 'dashboard.html';
        }
    });

    // Evento de submit do formulário
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            limparErro();
            
            const email = emailInput ? emailInput.value.trim() : '';
            const senha = senhaInput ? senhaInput.value : '';
            
            console.log("Tentando login com:", email);
            
            if (!email || !senha) {
                mostrarErro("Preencha todos os campos!");
                return;
            }
            
            setLoading(true);
            
            try {
                // Autenticar com Firebase Authentication (usuários reais do Firebase)
                const userCredential = await signInWithEmailAndPassword(auth, email, senha);
                console.log("Login bem-sucedido:", userCredential.user.email);
                // O redirecionamento será feito pelo onAuthStateChanged
                
            } catch (error) {
                console.error("Erro na autenticação:", error.code, error.message);
                
                // Tratar diferentes tipos de erro do Firebase
                let mensagemErro = "";
                
                switch (error.code) {
                    case 'auth/invalid-email':
                        mensagemErro = "❌ E-mail inválido. Verifique o formato do e-mail.";
                        break;
                    case 'auth/user-disabled':
                        mensagemErro = "❌ Este usuário foi desativado. Contate o administrador.";
                        break;
                    case 'auth/user-not-found':
                        mensagemErro = "❌ Usuário não encontrado. Verifique o e-mail cadastrado.";
                        break;
                    case 'auth/wrong-password':
                        mensagemErro = "❌ Senha incorreta. Tente novamente.";
                        break;
                    case 'auth/too-many-requests':
                        mensagemErro = "⚠️ Muitas tentativas. Aguarde alguns minutos.";
                        break;
                    case 'auth/network-request-failed':
                        mensagemErro = "🌐 Erro de rede. Verifique sua conexão com a internet.";
                        break;
                    default:
                        mensagemErro = `❌ Erro: ${error.message}`;
                }
                
                mostrarErro(mensagemErro);
                setLoading(false);
            }
        });
    }

    // Permitir login com Enter
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && loginForm) {
            e.preventDefault();
            const submitEvent = new Event('submit');
            loginForm.dispatchEvent(submitEvent);
        }
    });

    // Limpar erro ao começar a digitar
    if (emailInput) {
        emailInput.addEventListener('input', limparErro);
    }
    if (senhaInput) {
        senhaInput.addEventListener('input', limparErro);
    }
});