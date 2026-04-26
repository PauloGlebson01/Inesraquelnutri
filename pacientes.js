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
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAtpeuw5e9IgctiZh2UROXMEk-10BcUHAI",
  authDomain: "nutri-agendamentos.firebaseapp.com",
  projectId: "nutri-agendamentos",
  storageBucket: "nutri-agendamentos.firebasestorage.app",
  messagingSenderId: "192742643803",
  appId: "1:192742643803:web:4cf93b5fdcbfa8949d077e",
  measurementId: "G-CNQ26DG1N0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let pacientes = [];
let unsubscribePacientes = null;

// Elementos DOM
const pacientesGrid = document.getElementById('clientesGrid');
const searchInput = document.getElementById('searchCliente');
const btnLimparFiltros = document.getElementById('btnLimparFiltros');
const btnNovoPaciente = document.getElementById('btnNovoCliente');
const modalPaciente = document.getElementById('modalCliente');
const modalExcluir = document.getElementById('modalExcluir');
const formPaciente = document.getElementById('formCliente');
const modalTitle = document.getElementById('modalTitle');
const pacienteId = document.getElementById('clienteId');
const btnConfirmarExcluir = document.getElementById('confirmarExcluir');
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');

let pacienteParaExcluir = null;

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

function formatarTelefone(telefone) {
    if (!telefone) return '-';
    return telefone;
}

function formatarData(data) {
    if (!data) return '-';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getIniciais(nome) {
    if (!nome) return '?';
    const partes = nome.trim().split(' ');
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

function renderizarPacientes() {
    if (!pacientesGrid) return;
    
    let filtered = [...pacientes];
    
    const searchTerm = searchInput?.value.toLowerCase() || '';
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.nome?.toLowerCase().includes(searchTerm) ||
            p.telefone?.toLowerCase().includes(searchTerm) ||
            p.email?.toLowerCase().includes(searchTerm)
        );
    }
    
    if (filtered.length === 0) {
        pacientesGrid.innerHTML = `
            <div class="empty-clientes">
                <i class="fa-solid fa-users"></i>
                <p>Nenhum paciente encontrado</p>
                <button class="btn-primary" onclick="document.getElementById('btnNovoCliente').click()">
                    <i class="fa-solid fa-user-plus"></i> Adicionar Paciente
                </button>
            </div>
        `;
        return;
    }
    
    pacientesGrid.innerHTML = filtered.map(paciente => {
        const iniciais = getIniciais(paciente.nome);
        
        return `
            <div class="cliente-card" data-id="${paciente.id}">
                <div class="cliente-header">
                    <div class="cliente-avatar">
                        ${escapeHtml(iniciais)}
                    </div>
                    <div class="cliente-info">
                        <h3>${escapeHtml(paciente.nome || 'Sem nome')}</h3>
                        <span class="cliente-telefone">
                            <i class="fa-brands fa-whatsapp"></i> ${escapeHtml(paciente.telefone || '-')}
                        </span>
                    </div>
                </div>
                <div class="cliente-body">
                    ${paciente.email ? `
                        <div class="cliente-detalhe">
                            <span class="label"><i class="fa-solid fa-envelope"></i> E-mail</span>
                            <span class="value">${escapeHtml(paciente.email)}</span>
                        </div>
                    ` : ''}
                    ${paciente.nascimento ? `
                        <div class="cliente-detalhe">
                            <span class="label"><i class="fa-solid fa-cake-candles"></i> Nascimento</span>
                            <span class="value">${formatarData(paciente.nascimento)}</span>
                        </div>
                    ` : ''}
                    ${paciente.endereco ? `
                        <div class="cliente-detalhe">
                            <span class="label"><i class="fa-solid fa-location-dot"></i> Endereço</span>
                            <span class="value" style="font-size: 0.75rem;">${escapeHtml(paciente.endereco.substring(0, 40))}${paciente.endereco.length > 40 ? '...' : ''}</span>
                        </div>
                    ` : ''}
                    ${paciente.observacoes ? `
                        <div class="cliente-detalhe">
                            <span class="label"><i class="fa-solid fa-note-sticky"></i> Observações</span>
                            <span class="value" style="font-size: 0.75rem;">${escapeHtml(paciente.observacoes.substring(0, 40))}${paciente.observacoes.length > 40 ? '...' : ''}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="cliente-actions">
                    <button class="btn-edit" onclick="window.editarPaciente('${paciente.id}')">
                        <i class="fa-regular fa-pen-to-square"></i> Editar
                    </button>
                    <button class="btn-delete" onclick="window.excluirPaciente('${paciente.id}', '${escapeHtml(paciente.nome).replace(/'/g, "\\'")}')">
                        <i class="fa-regular fa-trash-can"></i> Excluir
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function atualizarEstatisticas() {
    try {
        const totalPacientes = pacientes.length;
        document.getElementById('totalClientes').textContent = totalPacientes;
        
        // Buscar consultas do mês atual
        const hoje = new Date();
        const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const primeiroDiaStr = primeiroDia.toISOString().split('T')[0];
        const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        const ultimoDiaStr = ultimoDia.toISOString().split('T')[0];
        
        const agendamentosRef = collection(db, "agendamentos");
        const q = query(agendamentosRef, 
            where("data", ">=", primeiroDiaStr),
            where("data", "<=", ultimoDiaStr),
            where("status", "==", "concluido")
        );
        const snapshot = await getDocs(q);
        
        const pacientesAtendidos = new Set();
        snapshot.forEach(doc => {
            const agendamento = doc.data();
            const pacienteNome = agendamento.cliente || agendamento.nome;
            if (pacienteNome) pacientesAtendidos.add(pacienteNome);
        });
        
        document.getElementById('clientesAtivos').textContent = pacientesAtendidos.size;
        
        // Pacientes fiéis (mais de 3 consultas)
        const todosAgendamentos = await getDocs(collection(db, "agendamentos"));
        const contagemPacientes = {};
        todosAgendamentos.forEach(doc => {
            const agendamento = doc.data();
            const pacienteNome = agendamento.cliente || agendamento.nome;
            if (pacienteNome && agendamento.status === 'concluido') {
                contagemPacientes[pacienteNome] = (contagemPacientes[pacienteNome] || 0) + 1;
            }
        });
        
        const pacientesFieis = Object.values(contagemPacientes).filter(count => count >= 3).length;
        document.getElementById('clientesFieis').textContent = pacientesFieis;
        
    } catch (error) {
        console.error("Erro ao atualizar estatísticas:", error);
    }
}

function carregarPacientes() {
    const q = query(collection(db, "clientes"), orderBy("nome", "asc"));
    
    unsubscribePacientes = onSnapshot(q, (snapshot) => {
        pacientes = [];
        snapshot.forEach(doc => {
            pacientes.push({ id: doc.id, ...doc.data() });
        });
        renderizarPacientes();
        atualizarEstatisticas();
    }, (error) => {
        console.error("Erro ao carregar pacientes:", error);
        if (pacientesGrid) {
            pacientesGrid.innerHTML = `
                <div class="empty-clientes">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <p>Erro ao carregar pacientes. Verifique sua conexão.</p>
                </div>
            `;
        }
    });
}

// CRUD Pacientes
async function salvarPaciente(dados) {
    try {
        if (dados.id) {
            const docRef = doc(db, "clientes", dados.id);
            await updateDoc(docRef, {
                nome: dados.nome,
                telefone: dados.telefone,
                email: dados.email,
                nascimento: dados.nascimento,
                endereco: dados.endereco,
                observacoes: dados.observacoes,
                atualizadoEm: new Date().toISOString()
            });
            mostrarToast("Paciente atualizado com sucesso!");
        } else {
            await addDoc(collection(db, "clientes"), {
                nome: dados.nome,
                telefone: dados.telefone,
                email: dados.email,
                nascimento: dados.nascimento,
                endereco: dados.endereco,
                observacoes: dados.observacoes,
                createdAt: new Date().toISOString(),
                atualizadoEm: new Date().toISOString()
            });
            mostrarToast("Paciente adicionado com sucesso!");
        }
        fecharModalPaciente();
    } catch (error) {
        console.error("Erro ao salvar paciente:", error);
        mostrarToast("Erro ao salvar paciente.", "erro");
    }
}

async function deletarPaciente(id) {
    try {
        await deleteDoc(doc(db, "clientes", id));
        mostrarToast("Paciente excluído com sucesso!");
        fecharModalExcluir();
    } catch (error) {
        console.error("Erro ao excluir paciente:", error);
        mostrarToast("Erro ao excluir paciente.", "erro");
    }
}

// Modal Functions
function abrirModalPaciente(paciente = null) {
    if (paciente) {
        modalTitle.innerHTML = '<i class="fa-regular fa-pen-to-square"></i> Editar Paciente';
        pacienteId.value = paciente.id;
        document.getElementById('clienteNome').value = paciente.nome || '';
        document.getElementById('clienteTelefone').value = paciente.telefone || '';
        document.getElementById('clienteEmail').value = paciente.email || '';
        document.getElementById('clienteNascimento').value = paciente.nascimento || '';
        document.getElementById('clienteEndereco').value = paciente.endereco || '';
        document.getElementById('clienteObservacoes').value = paciente.observacoes || '';
    } else {
        modalTitle.innerHTML = '<i class="fa-solid fa-user-plus"></i> Novo Paciente';
        pacienteId.value = '';
        formPaciente.reset();
    }
    modalPaciente.classList.add('active');
}

function fecharModalPaciente() {
    modalPaciente.classList.remove('active');
}

function abrirModalExcluir(id, nome) {
    pacienteParaExcluir = id;
    document.getElementById('excluirNome').textContent = nome;
    modalExcluir.classList.add('active');
}

function fecharModalExcluir() {
    modalExcluir.classList.remove('active');
    pacienteParaExcluir = null;
}

// Event Listeners
if (formPaciente) {
    formPaciente.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const nome = document.getElementById('clienteNome').value.trim();
        if (!nome) {
            mostrarToast("Informe o nome do paciente.", "erro");
            return;
        }
        
        const telefone = document.getElementById('clienteTelefone').value.trim();
        if (!telefone) {
            mostrarToast("Informe o telefone do paciente.", "erro");
            return;
        }
        
        const dados = {
            id: pacienteId.value,
            nome: nome,
            telefone: telefone,
            email: document.getElementById('clienteEmail').value,
            nascimento: document.getElementById('clienteNascimento').value,
            endereco: document.getElementById('clienteEndereco').value,
            observacoes: document.getElementById('clienteObservacoes').value
        };
        
        salvarPaciente(dados);
    });
}

if (btnNovoPaciente) {
    btnNovoPaciente.addEventListener('click', () => abrirModalPaciente());
}

if (btnConfirmarExcluir) {
    btnConfirmarExcluir.addEventListener('click', () => {
        if (pacienteParaExcluir) deletarPaciente(pacienteParaExcluir);
    });
}

if (btnLimparFiltros) {
    btnLimparFiltros.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        renderizarPacientes();
    });
}

if (searchInput) {
    searchInput.addEventListener('input', renderizarPacientes);
}

// Fechar modais
document.querySelectorAll('.modal-close, .modal-close-excluir, .btn-cancel, .btn-cancel-excluir').forEach(btn => {
    btn.addEventListener('click', () => {
        fecharModalPaciente();
        fecharModalExcluir();
    });
});

window.addEventListener('click', (e) => {
    if (e.target === modalPaciente) fecharModalPaciente();
    if (e.target === modalExcluir) fecharModalExcluir();
});

// Expor funções globalmente
window.editarPaciente = (id) => {
    const paciente = pacientes.find(p => p.id === id);
    if (paciente) abrirModalPaciente(paciente);
};

window.excluirPaciente = (id, nome) => {
    abrirModalExcluir(id, nome);
};

// Autenticação
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Usuário autenticado:", user.email);
        carregarPacientes();
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