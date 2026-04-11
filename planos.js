import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot, 
    query, 
    orderBy,
    where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

let planos = [];
let unsubscribePlanos = null;

// Elementos DOM
const planosGrid = document.getElementById('servicosGrid');
const searchInput = document.getElementById('searchServico');
const btnLimparFiltros = document.getElementById('btnLimparFiltros');
const btnNovoPlano = document.getElementById('btnNovoServico');
const modalPlano = document.getElementById('modalServico');
const modalExcluir = document.getElementById('modalExcluir');
const formPlano = document.getElementById('formServico');
const modalTitle = document.getElementById('modalTitle');
const planoId = document.getElementById('servicoId');
const btnConfirmarExcluir = document.getElementById('confirmarExcluir');
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');

let planoParaExcluir = null;

// Funções auxiliares
function mostrarToast(mensagem, tipo = 'sucesso') {
    toastMsg.textContent = mensagem;
    toast.style.background = tipo === 'sucesso' 
        ? 'linear-gradient(135deg, #10b981, #059669)'
        : 'linear-gradient(135deg, #ef4444, #dc2626)';
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function formatarDuracao(minutos) {
    if (!minutos) return '-';
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (horas > 0) {
        return `${horas}h ${mins > 0 ? mins + 'min' : ''}`;
    }
    return `${minutos} min`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getCategoriaIcon(categoria) {
    const icons = {
        'Consultoria': '📋',
        'Acompanhamento Periódico': '📈'
    };
    return icons[categoria] || '🥗';
}

function renderizarPlanos() {
    if (!planosGrid) return;
    
    let filtered = [...planos];
    
    const searchTerm = searchInput?.value.toLowerCase() || '';
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.nome?.toLowerCase().includes(searchTerm) ||
            p.categoria?.toLowerCase().includes(searchTerm) ||
            p.descricao?.toLowerCase().includes(searchTerm)
        );
    }
    
    if (filtered.length === 0) {
        planosGrid.innerHTML = `
            <div class="empty-servicos">
                <i class="fa-solid fa-apple-whole"></i>
                <p>Nenhum plano encontrado</p>
                <button class="btn-primary" onclick="document.getElementById('btnNovoServico').click()">
                    <i class="fa-solid fa-plus"></i> Adicionar Plano
                </button>
            </div>
        `;
        return;
    }
    
    planosGrid.innerHTML = filtered.map(plano => {
        const categoriaIcon = getCategoriaIcon(plano.categoria);
        const duracaoFormatada = formatarDuracao(plano.duracao);
        
        return `
            <div class="servico-card" data-id="${plano.id}">
                <div class="servico-header">
                    <div class="servico-info">
                        <h3>${escapeHtml(plano.nome || 'Sem nome')}</h3>
                        ${plano.categoria ? `
                            <span class="servico-categoria">
                                ${categoriaIcon} ${escapeHtml(plano.categoria)}
                            </span>
                        ` : ''}
                    </div>
                </div>
                <div class="servico-body">
                    <div class="servico-detalhe">
                        <span class="label"><i class="fa-regular fa-clock"></i> Duração</span>
                        <span class="value">${duracaoFormatada}</span>
                    </div>
                    <div class="servico-preco">
                        <span class="preco-valor">${formatarMoeda(plano.preco || 0)}</span>
                        <span class="preco-label">por consulta</span>
                    </div>
                    ${plano.descricao ? `
                        <div class="servico-descricao">
                            <i class="fa-regular fa-message"></i> ${escapeHtml(plano.descricao)}
                        </div>
                    ` : ''}
                </div>
                <div class="servico-actions">
                    <button class="btn-edit" onclick="window.editarPlano('${plano.id}')">
                        <i class="fa-regular fa-pen-to-square"></i> Editar
                    </button>
                    <button class="btn-delete" onclick="window.excluirPlano('${plano.id}', '${escapeHtml(plano.nome).replace(/'/g, "\\'")}')">
                        <i class="fa-regular fa-trash-can"></i> Excluir
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function atualizarEstatisticas() {
    try {
        const totalPlanos = planos.length;
        document.getElementById('totalServicos').textContent = totalPlanos;
        
        const agendamentosRef = collection(db, "agendamentos");
        const q = query(agendamentosRef, where("status", "==", "concluido"));
        const snapshot = await getDocs(q);
        
        let totalRealizados = 0;
        let faturamentoTotal = 0;
        
        snapshot.forEach(doc => {
            const agendamento = doc.data();
            totalRealizados++;
            faturamentoTotal += agendamento.valor || 0;
        });
        
        document.getElementById('totalRealizados').textContent = totalRealizados;
        document.getElementById('faturamentoServicos').textContent = formatarMoeda(faturamentoTotal);
        
    } catch (error) {
        console.error("Erro ao atualizar estatísticas:", error);
    }
}

function carregarPlanos() {
    const q = query(collection(db, "servicos"), orderBy("nome", "asc"));
    
    unsubscribePlanos = onSnapshot(q, (snapshot) => {
        planos = [];
        snapshot.forEach(doc => {
            planos.push({ id: doc.id, ...doc.data() });
        });
        renderizarPlanos();
        atualizarEstatisticas();
    }, (error) => {
        console.error("Erro ao carregar planos:", error);
        if (planosGrid) {
            planosGrid.innerHTML = `
                <div class="empty-servicos">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <p>Erro ao carregar planos. Verifique sua conexão.</p>
                </div>
            `;
        }
    });
}

// CRUD Planos
async function salvarPlano(dados) {
    try {
        if (dados.id) {
            const docRef = doc(db, "servicos", dados.id);
            await updateDoc(docRef, {
                nome: dados.nome,
                duracao: Number(dados.duracao),
                preco: Number(dados.preco),
                categoria: dados.categoria,
                descricao: dados.descricao,
                atualizadoEm: new Date().toISOString()
            });
            mostrarToast("Plano atualizado com sucesso!");
        } else {
            await addDoc(collection(db, "servicos"), {
                nome: dados.nome,
                duracao: Number(dados.duracao),
                preco: Number(dados.preco),
                categoria: dados.categoria,
                descricao: dados.descricao,
                createdAt: new Date().toISOString(),
                atualizadoEm: new Date().toISOString()
            });
            mostrarToast("Plano adicionado com sucesso!");
        }
        fecharModalPlano();
    } catch (error) {
        console.error("Erro ao salvar plano:", error);
        mostrarToast("Erro ao salvar plano.", "erro");
    }
}

async function deletarPlano(id) {
    try {
        await deleteDoc(doc(db, "servicos", id));
        mostrarToast("Plano excluído com sucesso!");
        fecharModalExcluir();
    } catch (error) {
        console.error("Erro ao excluir plano:", error);
        mostrarToast("Erro ao excluir plano.", "erro");
    }
}

// Modal Functions
function abrirModalPlano(plano = null) {
    if (plano) {
        modalTitle.innerHTML = '<i class="fa-regular fa-pen-to-square"></i> Editar Plano';
        planoId.value = plano.id;
        document.getElementById('servicoNome').value = plano.nome || '';
        document.getElementById('servicoDuracao').value = plano.duracao || 60;
        document.getElementById('servicoPreco').value = plano.preco || 0;
        document.getElementById('servicoCategoria').value = plano.categoria || '';
        document.getElementById('servicoDescricao').value = plano.descricao || '';
    } else {
        modalTitle.innerHTML = '<i class="fa-solid fa-plus"></i> Novo Plano';
        planoId.value = '';
        formPlano.reset();
        document.getElementById('servicoDuracao').value = 60;
    }
    modalPlano.classList.add('active');
}

function fecharModalPlano() {
    modalPlano.classList.remove('active');
}

function abrirModalExcluir(id, nome) {
    planoParaExcluir = id;
    document.getElementById('excluirNome').textContent = nome;
    modalExcluir.classList.add('active');
}

function fecharModalExcluir() {
    modalExcluir.classList.remove('active');
    planoParaExcluir = null;
}

// Event Listeners
if (formPlano) {
    formPlano.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const nome = document.getElementById('servicoNome').value.trim();
        if (!nome) {
            mostrarToast("Informe o nome do plano.", "erro");
            return;
        }
        
        const duracao = document.getElementById('servicoDuracao').value;
        if (!duracao || duracao < 15) {
            mostrarToast("Informe uma duração válida (mínimo 15 minutos).", "erro");
            return;
        }
        
        const preco = document.getElementById('servicoPreco').value;
        if (!preco || preco <= 0) {
            mostrarToast("Informe um preço válido.", "erro");
            return;
        }
        
        const dados = {
            id: planoId.value,
            nome: nome,
            duracao: duracao,
            preco: preco,
            categoria: document.getElementById('servicoCategoria').value,
            descricao: document.getElementById('servicoDescricao').value
        };
        
        salvarPlano(dados);
    });
}

if (btnNovoPlano) {
    btnNovoPlano.addEventListener('click', () => abrirModalPlano());
}

if (btnConfirmarExcluir) {
    btnConfirmarExcluir.addEventListener('click', () => {
        if (planoParaExcluir) deletarPlano(planoParaExcluir);
    });
}

if (btnLimparFiltros) {
    btnLimparFiltros.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        renderizarPlanos();
    });
}

if (searchInput) {
    searchInput.addEventListener('input', renderizarPlanos);
}

// Fechar modais
document.querySelectorAll('.modal-close, .modal-close-excluir, .btn-cancel, .btn-cancel-excluir').forEach(btn => {
    btn.addEventListener('click', () => {
        fecharModalPlano();
        fecharModalExcluir();
    });
});

window.addEventListener('click', (e) => {
    if (e.target === modalPlano) fecharModalPlano();
    if (e.target === modalExcluir) fecharModalExcluir();
});

// Expor funções globalmente
window.editarPlano = (id) => {
    const plano = planos.find(p => p.id === id);
    if (plano) abrirModalPlano(plano);
};

window.excluirPlano = (id, nome) => {
    abrirModalExcluir(id, nome);
};

// Autenticação
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Usuário autenticado:", user.email);
        carregarPlanos();
    } else {
        console.log("Usuário não autenticado, redirecionando para login...");
        window.location.href = 'login.html';
    }
});

// Logout
const logoutBtn = document.getElementById('logout');
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        try {
            await signOut(auth);
            console.log("Logout realizado com sucesso");
            window.location.href = 'login.html';
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
            mostrarToast("Erro ao fazer logout.", "erro");
        }
    };
}