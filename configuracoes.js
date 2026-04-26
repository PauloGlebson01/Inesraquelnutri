import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    getDocs,
    setDoc,
    deleteField
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAmodWGagSV-yco1FQ1-U81Xhd-y4NsE3s",
  authDomain: "ines-raquel-softclick-nutri.firebaseapp.com",
  projectId: "ines-raquel-softclick-nutri",
  storageBucket: "ines-raquel-softclick-nutri.firebasestorage.app",
  messagingSenderId: "284677746064",
  appId: "1:284677746064:web:4daac55dd6b2491dbd9715",
  measurementId: "G-5C0YC43V2G"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Elementos DOM
const studioNome = document.getElementById('studioNome');
const studioTelefone = document.getElementById('studioTelefone');
const studioEmail = document.getElementById('studioEmail');
const studioEndereco = document.getElementById('studioEndereco');
const btnSalvarStudio = document.getElementById('btnSalvarStudio');

const horarioSemana = document.getElementById('horarioSemana');
const horarioSabado = document.getElementById('horarioSabado');
const horarioDomingo = document.getElementById('horarioDomingo');
const btnSalvarHorario = document.getElementById('btnSalvarHorario');

const somNotificacao = document.getElementById('somNotificacao');
const emailNotificacao = document.getElementById('emailNotificacao');
const whatsappLembretes = document.getElementById('whatsappLembretes');

const btnBackup = document.getElementById('btnBackup');
const btnRestaurar = document.getElementById('btnRestaurar');
const ultimoBackup = document.getElementById('ultimoBackup');

const novaSenha = document.getElementById('novaSenha');
const confirmarSenha = document.getElementById('confirmarSenha');
const btnAlterarSenha = document.getElementById('btnAlterarSenha');

const modoEscuro = document.getElementById('modoEscuro');
const corPrimaria = document.getElementById('corPrimaria');

const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');

function mostrarToast(mensagem, tipo = 'sucesso') {
    if (!toastMsg) return;
    toastMsg.textContent = mensagem;
    toast.style.background = tipo === 'sucesso' 
        ? 'linear-gradient(135deg, #10b981, #059669)'
        : 'linear-gradient(135deg, #ef4444, #dc2626)';
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// =============================
// LIMPAR CACHE DO FIRESTORE
// =============================

async function limparCacheFirestore() {
    try {
        console.log("🗑️ Limpando cache do Firestore...");
        // Forçar recarregar dados sem cache
        const docRef = doc(db, "configuracoes", "studio");
        await getDoc(docRef); // Isso força uma nova leitura
        console.log("✅ Cache limpo");
    } catch (error) {
        console.error("Erro ao limpar cache:", error);
    }
}

// =============================
// SALVAR CONFIGURAÇÕES
// =============================

async function salvarConfiguracoes(tipo, dados) {
    try {
        console.log(`💾 Salvando ${tipo}:`, dados);
        
        const docRef = doc(db, "configuracoes", "studio");
        
        // Buscar dados atuais
        const docSnap = await getDoc(docRef);
        let configAtual = {};
        if (docSnap.exists()) {
            configAtual = docSnap.data();
        }
        
        // Se o email estiver vazio, remover o campo completamente
        let novosDados = { ...configAtual, ...dados, atualizadoEm: new Date().toISOString() };
        
        // Se email for string vazia, remover o campo
        if (dados.hasOwnProperty('email') && (!dados.email || dados.email === '')) {
            delete novosDados.email;
            console.log("📧 E-mail removido do documento");
        }
        
        // Salvar no Firestore
        await setDoc(docRef, novosDados);
        console.log("✅ Dados salvos:", novosDados);
        
        mostrarToast(`${tipo} salvo com sucesso!`);
        
        // Recarregar configurações
        await carregarConfiguracoes();
        
    } catch (error) {
        console.error("❌ Erro:", error);
        mostrarToast(`Erro ao salvar: ${error.message}`, "erro");
    }
}

// =============================
// CARREGAR CONFIGURAÇÕES
// =============================

async function carregarConfiguracoes() {
    try {
        console.log("📂 Carregando configurações...");
        const docRef = doc(db, "configuracoes", "studio");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("📋 Dados carregados:", data);
            
            // Carregar dados (se não existir, fica vazio)
            if (studioNome) studioNome.value = data.nome || '';
            if (studioTelefone) studioTelefone.value = data.telefone || '';
            if (studioEmail) studioEmail.value = data.email || ''; // Se não existir, fica vazio
            if (studioEndereco) studioEndereco.value = data.endereco || '';
            
            // Horários
            if (horarioSemana) horarioSemana.value = data.horarioSemana || '09:00 - 18:00';
            if (horarioSabado) horarioSabado.value = data.horarioSabado || '09:00 - 14:00';
            if (horarioDomingo) horarioDomingo.value = data.horarioDomingo || 'Fechado';
            
            // Notificações
            if (somNotificacao) somNotificacao.checked = data.somNotificacao !== false;
            if (emailNotificacao) emailNotificacao.checked = data.emailNotificacao || false;
            if (whatsappLembretes) whatsappLembretes.checked = data.whatsappLembretes !== false;
            
            // Aparência
            if (modoEscuro) {
                modoEscuro.checked = data.modoEscuro !== false;
                if (!modoEscuro.checked) {
                    document.body.classList.remove('dark');
                    document.body.classList.add('light');
                } else {
                    document.body.classList.remove('light');
                    document.body.classList.add('dark');
                }
            }
            if (corPrimaria) corPrimaria.value = data.corPrimaria || '#10b981';
            
            // Último backup
            if (ultimoBackup && data.ultimoBackup) {
                const dataBackup = new Date(data.ultimoBackup);
                ultimoBackup.textContent = dataBackup.toLocaleString('pt-BR');
            } else if (ultimoBackup) {
                ultimoBackup.textContent = 'Nunca realizado';
            }
        } else {
            console.log("📝 Nenhuma configuração encontrada, usando padrões");
            if (studioNome) studioNome.value = '';
            if (studioTelefone) studioTelefone.value = '';
            if (studioEmail) studioEmail.value = '';
            if (studioEndereco) studioEndereco.value = '';
            if (horarioSemana) horarioSemana.value = '09:00 - 18:00';
            if (horarioSabado) horarioSabado.value = '09:00 - 14:00';
            if (horarioDomingo) horarioDomingo.value = 'Fechado';
            if (somNotificacao) somNotificacao.checked = true;
            if (whatsappLembretes) whatsappLembretes.checked = true;
            if (modoEscuro) modoEscuro.checked = true;
            if (corPrimaria) corPrimaria.value = '#10b981';
        }
    } catch (error) {
        console.error("❌ Erro ao carregar:", error);
        mostrarToast("Erro ao carregar configurações.", "erro");
    }
}

// =============================
// DADOS DA PROFISSIONAL
// =============================

if (btnSalvarStudio) {
    btnSalvarStudio.addEventListener('click', async () => {
        const originalText = btnSalvarStudio.innerHTML;
        btnSalvarStudio.disabled = true;
        btnSalvarStudio.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
        
        // Obter o valor do e-mail (pode ser vazio)
        const emailValue = studioEmail?.value || '';
        console.log("📧 Valor do e-mail a ser salvo:", emailValue === '' ? '(vazio)' : emailValue);
        
        const dados = {
            nome: studioNome?.value || '',
            telefone: studioTelefone?.value || '',
            endereco: studioEndereco?.value || ''
        };
        
        // Só incluir email se não estiver vazio
        if (emailValue !== '') {
            dados.email = emailValue;
        }
        
        console.log("📤 Salvando dados:", dados);
        await salvarConfiguracoes("Dados da profissional", dados);
        
        btnSalvarStudio.disabled = false;
        btnSalvarStudio.innerHTML = originalText;
        
        // Forçar recarregar para garantir
        setTimeout(() => {
            carregarConfiguracoes();
        }, 500);
    });
}

// =============================
// HORÁRIOS
// =============================

if (btnSalvarHorario) {
    btnSalvarHorario.addEventListener('click', async () => {
        const originalText = btnSalvarHorario.innerHTML;
        btnSalvarHorario.disabled = true;
        btnSalvarHorario.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
        
        const dados = {
            horarioSemana: horarioSemana?.value || '',
            horarioSabado: horarioSabado?.value || '',
            horarioDomingo: horarioDomingo?.value || ''
        };
        await salvarConfiguracoes("Horários", dados);
        
        btnSalvarHorario.disabled = false;
        btnSalvarHorario.innerHTML = originalText;
    });
}

// =============================
// NOTIFICAÇÕES
// =============================

if (somNotificacao && emailNotificacao && whatsappLembretes) {
    const salvarNotificacoes = async () => {
        await salvarConfiguracoes("Notificações", {
            somNotificacao: somNotificacao.checked,
            emailNotificacao: emailNotificacao.checked,
            whatsappLembretes: whatsappLembretes.checked
        });
    };
    
    somNotificacao.addEventListener('change', salvarNotificacoes);
    emailNotificacao.addEventListener('change', salvarNotificacoes);
    whatsappLembretes.addEventListener('change', salvarNotificacoes);
}

// =============================
// BACKUP
// =============================

if (btnBackup) {
    btnBackup.addEventListener('click', async () => {
        const originalText = btnBackup.innerHTML;
        btnBackup.disabled = true;
        btnBackup.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando backup...';
        
        try {
            const configDoc = await getDoc(doc(db, "configuracoes", "studio"));
            
            const pacientes = [];
            const pacientesSnap = await getDocs(collection(db, "clientes"));
            pacientesSnap.forEach(doc => pacientes.push({ id: doc.id, ...doc.data() }));
            
            const planos = [];
            const planosSnap = await getDocs(collection(db, "servicos"));
            planosSnap.forEach(doc => planos.push({ id: doc.id, ...doc.data() }));
            
            const agendamentos = [];
            const agendamentosSnap = await getDocs(collection(db, "agendamentos"));
            agendamentosSnap.forEach(doc => agendamentos.push({ id: doc.id, ...doc.data() }));
            
            const produtos = [];
            const produtosSnap = await getDocs(collection(db, "produtos"));
            produtosSnap.forEach(doc => produtos.push({ id: doc.id, ...doc.data() }));
            
            const resultados = [];
            const resultadosSnap = await getDocs(collection(db, "resultados"));
            resultadosSnap.forEach(doc => resultados.push({ id: doc.id, ...doc.data() }));
            
            const backupData = {
                dataBackup: new Date().toISOString(),
                versao: "1.0",
                configuracoes: configDoc.exists() ? configDoc.data() : {},
                pacientes, planos, agendamentos, produtos, resultados
            };
            
            const jsonStr = JSON.stringify(backupData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_nutri_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            await setDoc(doc(db, "configuracoes", "studio"), { ultimoBackup: new Date().toISOString() }, { merge: true });
            if (ultimoBackup) ultimoBackup.textContent = new Date().toLocaleString('pt-BR');
            
            mostrarToast(`✅ Backup realizado!`);
        } catch (error) {
            console.error("Erro:", error);
            mostrarToast("Erro ao fazer backup.", "erro");
        } finally {
            btnBackup.disabled = false;
            btnBackup.innerHTML = originalText;
        }
    });
}

// =============================
// RESTAURAR BACKUP
// =============================

if (btnRestaurar) {
    btnRestaurar.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const backupData = JSON.parse(event.target.result);
                    if (backupData.configuracoes) {
                        await setDoc(doc(db, "configuracoes", "studio"), backupData.configuracoes);
                    }
                    mostrarToast("Backup restaurado! Recarregue a página.", "sucesso");
                    setTimeout(() => window.location.reload(), 2000);
                } catch (error) {
                    mostrarToast("Erro ao restaurar backup.", "erro");
                }
            };
            reader.readAsText(file);
        };
        input.click();
    });
}

// =============================
// ALTERAR SENHA
// =============================

if (btnAlterarSenha) {
    btnAlterarSenha.addEventListener('click', async () => {
        const senha = novaSenha?.value;
        const confirmar = confirmarSenha?.value;
        
        if (!senha || senha.length < 6) {
            mostrarToast("A senha deve ter no mínimo 6 caracteres.", "erro");
            return;
        }
        if (senha !== confirmar) {
            mostrarToast("As senhas não coincidem.", "erro");
            return;
        }
        
        const originalText = btnAlterarSenha.innerHTML;
        btnAlterarSenha.disabled = true;
        btnAlterarSenha.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Alterando...';
        
        try {
            const user = auth.currentUser;
            if (user) {
                await updatePassword(user, senha);
                mostrarToast("Senha alterada com sucesso!");
                novaSenha.value = '';
                confirmarSenha.value = '';
            } else {
                mostrarToast("Usuário não autenticado.", "erro");
            }
        } catch (error) {
            mostrarToast("Erro ao alterar senha.", "erro");
        } finally {
            btnAlterarSenha.disabled = false;
            btnAlterarSenha.innerHTML = originalText;
        }
    });
}

// =============================
// MODO ESCURO
// =============================

if (modoEscuro) {
    modoEscuro.addEventListener('change', async () => {
        const isDark = modoEscuro.checked;
        if (isDark) {
            document.body.classList.remove('light');
            document.body.classList.add('dark');
        } else {
            document.body.classList.remove('dark');
            document.body.classList.add('light');
        }
        await salvarConfiguracoes("Aparência", { modoEscuro: isDark });
    });
}

// =============================
// COR PRIMÁRIA
// =============================

if (corPrimaria) {
    corPrimaria.addEventListener('change', async () => {
        const cor = corPrimaria.value;
        document.documentElement.style.setProperty('--primary', cor);
        localStorage.setItem('primaryColor', cor);
        await salvarConfiguracoes("Aparência", { corPrimaria: cor });
    });
}

// =============================
// INICIALIZAÇÃO
// =============================

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Inicializando página de configurações...");
    carregarConfiguracoes();
    
    const savedColor = localStorage.getItem('primaryColor');
    if (savedColor) {
        document.documentElement.style.setProperty('--primary', savedColor);
        if (corPrimaria) corPrimaria.value = savedColor;
    }
});

// =============================
// AUTENTICAÇÃO
// =============================

onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("✅ Usuário autenticado:", user.email);
    } else {
        window.location.href = 'login.html';
    }
});

const logoutBtn = document.getElementById('logout');
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        await signOut(auth);
        window.location.href = 'login.html';
    };
}