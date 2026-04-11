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
    getDocs,
    Timestamp
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

let pagamentos = [];
let clientes = [];
let servicos = [];
let unsubscribePagamentos = null;

// Elementos DOM
const pagamentosGrid = document.getElementById('pagamentosGrid');
const dataInicio = document.getElementById('dataInicio');
const dataFim = document.getElementById('dataFim');
const filterMetodo = document.getElementById('filterMetodo');
const filterStatus = document.getElementById('filterStatus');
const btnFiltrar = document.getElementById('btnFiltrar');
const btnLimparFiltros = document.getElementById('btnLimparFiltros');
const btnNovoPagamento = document.getElementById('btnNovoPagamento');
const modalPagamento = document.getElementById('modalPagamento');
const modalExcluir = document.getElementById('modalExcluir');
const formPagamento = document.getElementById('formPagamento');
const modalTitle = document.getElementById('modalTitle');
const pagamentoId = document.getElementById('pagamentoId');
const pagamentoCliente = document.getElementById('pagamentoCliente');
const pagamentoServico = document.getElementById('pagamentoServico');
const btnConfirmarExcluir = document.getElementById('confirmarExcluir');
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');

let pagamentoParaExcluir = null;
let filtrosAtivos = {
    dataInicio: null,
    dataFim: null,
    metodo: null,
    status: null
};

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

function formatarData(data) {
    if (!data) return '-';
    if (data.toDate) data = data.toDate();
    if (data.seconds) data = new Date(data.seconds * 1000);
    if (typeof data === 'string') data = new Date(data);
    return data.toLocaleDateString('pt-BR');
}

function getMetodoIcon(metodo) {
    const icons = {
        'dinheiro': '💵',
        'pix': '📱',
        'cartao_credito': '💳',
        'cartao_debito': '💳',
        'transferencia': '🏦'
    };
    return icons[metodo] || '💰';
}

function getMetodoNome(metodo) {
    const nomes = {
        'dinheiro': 'Dinheiro',
        'pix': 'Pix',
        'cartao_credito': 'Cartão Crédito',
        'cartao_debito': 'Cartão Débito',
        'transferencia': 'Transferência'
    };
    return nomes[metodo] || metodo;
}

function getStatusNome(status) {
    const nomes = {
        'pago': 'Pago',
        'pendente': 'Pendente',
        'cancelado': 'Cancelado'
    };
    return nomes[status] || status;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function carregarClientesEServicos() {
    // Carregar clientes
    const clientesRef = collection(db, "clientes");
    onSnapshot(clientesRef, (snapshot) => {
        clientes = [];
        snapshot.forEach(doc => {
            clientes.push({ id: doc.id, ...doc.data() });
        });
        
        // Atualizar select de clientes
        pagamentoCliente.innerHTML = '<option value="">Selecione um cliente</option>';
        clientes.forEach(cliente => {
            pagamentoCliente.innerHTML += `<option value="${cliente.id}">${escapeHtml(cliente.nome)}</option>`;
        });
    });
    
    // Carregar serviços
    const servicosRef = collection(db, "servicos");
    onSnapshot(servicosRef, (snapshot) => {
        servicos = [];
        snapshot.forEach(doc => {
            servicos.push({ id: doc.id, ...doc.data() });
        });
        
        // Atualizar select de serviços
        pagamentoServico.innerHTML = '<option value="">Selecione um serviço</option>';
        servicos.forEach(servico => {
            pagamentoServico.innerHTML += `<option value="${servico.id}" data-preco="${servico.preco}">${escapeHtml(servico.nome)} - ${formatarMoeda(servico.preco)}</option>`;
        });
    });
}

// Atualizar valor automaticamente ao selecionar serviço
if (pagamentoServico) {
    pagamentoServico.addEventListener('change', () => {
        const selectedOption = pagamentoServico.options[pagamentoServico.selectedIndex];
        const preco = selectedOption.getAttribute('data-preco');
        if (preco) {
            document.getElementById('pagamentoValor').value = preco;
        }
    });
}

function renderizarPagamentos() {
    if (!pagamentosGrid) return;
    
    let filtered = [...pagamentos];
    
    // Filtro por data
    if (filtrosAtivos.dataInicio) {
        filtered = filtered.filter(p => p.data >= filtrosAtivos.dataInicio);
    }
    if (filtrosAtivos.dataFim) {
        filtered = filtered.filter(p => p.data <= filtrosAtivos.dataFim);
    }
    
    // Filtro por método
    if (filtrosAtivos.metodo) {
        filtered = filtered.filter(p => p.metodo === filtrosAtivos.metodo);
    }
    
    // Filtro por status
    if (filtrosAtivos.status) {
        filtered = filtered.filter(p => p.status === filtrosAtivos.status);
    }
    
    if (filtered.length === 0) {
        pagamentosGrid.innerHTML = `
            <div class="empty-pagamentos">
                <i class="fa-solid fa-credit-card"></i>
                <p>Nenhum pagamento encontrado</p>
                <button class="btn-primary" onclick="document.getElementById('btnNovoPagamento').click()">
                    <i class="fa-solid fa-plus"></i> Registrar Pagamento
                </button>
            </div>
        `;
        return;
    }
    
    pagamentosGrid.innerHTML = filtered.map(pagamento => {
        const cliente = clientes.find(c => c.id === pagamento.clienteId);
        const servico = servicos.find(s => s.id === pagamento.servicoId);
        const metodoIcon = getMetodoIcon(pagamento.metodo);
        const metodoNome = getMetodoNome(pagamento.metodo);
        const statusNome = getStatusNome(pagamento.status);
        
        return `
            <div class="pagamento-card" data-id="${pagamento.id}">
                <div class="pagamento-header">
                    <div class="pagamento-cliente">
                        <h3>${escapeHtml(cliente?.nome || 'Cliente não encontrado')}</h3>
                        <span>${escapeHtml(servico?.nome || 'Serviço não encontrado')}</span>
                    </div>
                    <div class="pagamento-status ${pagamento.status}">
                        ${statusNome}
                    </div>
                </div>
                <div class="pagamento-body">
                    <div class="pagamento-detalhe">
                        <span class="label"><i class="fa-regular fa-calendar"></i> Data</span>
                        <span class="value">${formatarData(pagamento.data)}</span>
                    </div>
                    <div class="pagamento-detalhe">
                        <span class="label"><i class="fa-solid fa-credit-card"></i> Método</span>
                        <span class="value">${metodoIcon} ${metodoNome}</span>
                    </div>
                    <div class="pagamento-valor">
                        <span class="valor">${formatarMoeda(pagamento.valor)}</span>
                        <span class="metodo">${metodoIcon}</span>
                    </div>
                    ${pagamento.observacao ? `
                        <div class="pagamento-observacao">
                            <i class="fa-solid fa-comment"></i> ${escapeHtml(pagamento.observacao)}
                        </div>
                    ` : ''}
                </div>
                <div class="pagamento-actions">
                    <button class="btn-edit-pagamento" onclick="window.editarPagamento('${pagamento.id}')">
                        <i class="fa-regular fa-pen-to-square"></i> Editar
                    </button>
                    <button class="btn-delete-pagamento" onclick="window.excluirPagamento('${pagamento.id}')">
                        <i class="fa-regular fa-trash-can"></i> Excluir
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function atualizarEstatisticas() {
    let totalRecebido = 0;
    let totalPendente = 0;
    
    pagamentos.forEach(pagamento => {
        if (pagamento.status === 'pago') {
            totalRecebido += pagamento.valor;
        } else if (pagamento.status === 'pendente') {
            totalPendente += pagamento.valor;
        }
    });
    
    // Calcular média diária dos últimos 30 dias
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
    const trintaDiasAtrasStr = trintaDiasAtras.toISOString().split('T')[0];
    
    let somaUltimos30Dias = 0;
    let diasComPagamento = new Set();
    
    pagamentos.forEach(pagamento => {
        if (pagamento.status === 'pago' && pagamento.data >= trintaDiasAtrasStr) {
            somaUltimos30Dias += pagamento.valor;
            diasComPagamento.add(pagamento.data);
        }
    });
    
    const mediaDiaria = diasComPagamento.size > 0 ? somaUltimos30Dias / diasComPagamento.size : 0;
    
    document.getElementById('totalRecebido').textContent = formatarMoeda(totalRecebido);
    document.getElementById('totalPendente').textContent = formatarMoeda(totalPendente);
    document.getElementById('mediaDiaria').textContent = formatarMoeda(mediaDiaria);
    document.getElementById('totalTransacoes').textContent = pagamentos.length;
}

function carregarPagamentos() {
    const q = query(collection(db, "pagamentos"), orderBy("data", "desc"));
    
    unsubscribePagamentos = onSnapshot(q, (snapshot) => {
        pagamentos = [];
        snapshot.forEach(doc => {
            pagamentos.push({ id: doc.id, ...doc.data() });
        });
        renderizarPagamentos();
        atualizarEstatisticas();
    }, (error) => {
        console.error("Erro ao carregar pagamentos:", error);
        if (pagamentosGrid) {
            pagamentosGrid.innerHTML = `
                <div class="empty-pagamentos">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <p>Erro ao carregar pagamentos. Verifique sua conexão.</p>
                </div>
            `;
        }
    });
}

// CRUD Pagamentos
async function salvarPagamento(dados) {
    try {
        if (dados.id) {
            const docRef = doc(db, "pagamentos", dados.id);
            await updateDoc(docRef, {
                clienteId: dados.clienteId,
                servicoId: dados.servicoId,
                valor: Number(dados.valor),
                metodo: dados.metodo,
                data: dados.data,
                status: dados.status,
                observacao: dados.observacao,
                atualizadoEm: Timestamp.now()
            });
            mostrarToast("Pagamento atualizado com sucesso!");
        } else {
            await addDoc(collection(db, "pagamentos"), {
                clienteId: dados.clienteId,
                servicoId: dados.servicoId,
                valor: Number(dados.valor),
                metodo: dados.metodo,
                data: dados.data,
                status: dados.status,
                observacao: dados.observacao,
                createdAt: Timestamp.now(),
                atualizadoEm: Timestamp.now()
            });
            mostrarToast("Pagamento registrado com sucesso!");
        }
        fecharModalPagamento();
    } catch (error) {
        console.error("Erro ao salvar pagamento:", error);
        mostrarToast("Erro ao salvar pagamento.", "erro");
    }
}

async function deletarPagamento(id) {
    try {
        await deleteDoc(doc(db, "pagamentos", id));
        mostrarToast("Pagamento excluído com sucesso!");
        fecharModalExcluir();
    } catch (error) {
        console.error("Erro ao excluir pagamento:", error);
        mostrarToast("Erro ao excluir pagamento.", "erro");
    }
}

// Modal Functions
function abrirModalPagamento(pagamento = null) {
    if (pagamento) {
        modalTitle.innerHTML = '<i class="fa-regular fa-pen-to-square"></i> Editar Pagamento';
        pagamentoId.value = pagamento.id;
        document.getElementById('pagamentoCliente').value = pagamento.clienteId || '';
        document.getElementById('pagamentoServico').value = pagamento.servicoId || '';
        document.getElementById('pagamentoValor').value = pagamento.valor || '';
        document.getElementById('pagamentoMetodo').value = pagamento.metodo || '';
        document.getElementById('pagamentoData').value = pagamento.data || '';
        document.getElementById('pagamentoStatus').value = pagamento.status || '';
        document.getElementById('pagamentoObservacao').value = pagamento.observacao || '';
    } else {
        modalTitle.innerHTML = '<i class="fa-solid fa-plus"></i> Novo Pagamento';
        pagamentoId.value = '';
        formPagamento.reset();
        document.getElementById('pagamentoData').value = new Date().toISOString().split('T')[0];
        document.getElementById('pagamentoStatus').value = 'pago';
    }
    modalPagamento.classList.add('active');
}

function fecharModalPagamento() {
    modalPagamento.classList.remove('active');
}

function abrirModalExcluir(id) {
    pagamentoParaExcluir = id;
    const pagamento = pagamentos.find(p => p.id === id);
    if (pagamento) {
        const cliente = clientes.find(c => c.id === pagamento.clienteId);
        document.getElementById('excluirDescricao').textContent = `${cliente?.nome || 'Cliente'} - ${formatarMoeda(pagamento.valor)}`;
    }
    modalExcluir.classList.add('active');
}

function fecharModalExcluir() {
    modalExcluir.classList.remove('active');
    pagamentoParaExcluir = null;
}

// Filtros
function aplicarFiltros() {
    filtrosAtivos.dataInicio = dataInicio?.value || null;
    filtrosAtivos.dataFim = dataFim?.value || null;
    filtrosAtivos.metodo = filterMetodo?.value || null;
    filtrosAtivos.status = filterStatus?.value || null;
    renderizarPagamentos();
}

function limparFiltros() {
    if (dataInicio) dataInicio.value = '';
    if (dataFim) dataFim.value = '';
    if (filterMetodo) filterMetodo.value = '';
    if (filterStatus) filterStatus.value = '';
    filtrosAtivos = { dataInicio: null, dataFim: null, metodo: null, status: null };
    renderizarPagamentos();
}

// Event Listeners
if (formPagamento) {
    formPagamento.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const clienteId = document.getElementById('pagamentoCliente').value;
        const servicoId = document.getElementById('pagamentoServico').value;
        const valor = document.getElementById('pagamentoValor').value;
        
        if (!clienteId) {
            mostrarToast("Selecione um cliente.", "erro");
            return;
        }
        
        if (!servicoId) {
            mostrarToast("Selecione um serviço.", "erro");
            return;
        }
        
        if (!valor || valor <= 0) {
            mostrarToast("Informe um valor válido.", "erro");
            return;
        }
        
        const dados = {
            id: pagamentoId.value,
            clienteId: clienteId,
            servicoId: servicoId,
            valor: valor,
            metodo: document.getElementById('pagamentoMetodo').value,
            data: document.getElementById('pagamentoData').value,
            status: document.getElementById('pagamentoStatus').value,
            observacao: document.getElementById('pagamentoObservacao').value
        };
        
        salvarPagamento(dados);
    });
}

if (btnNovoPagamento) {
    btnNovoPagamento.addEventListener('click', () => abrirModalPagamento());
}

if (btnConfirmarExcluir) {
    btnConfirmarExcluir.addEventListener('click', () => {
        if (pagamentoParaExcluir) deletarPagamento(pagamentoParaExcluir);
    });
}

if (btnFiltrar) {
    btnFiltrar.addEventListener('click', aplicarFiltros);
}

if (btnLimparFiltros) {
    btnLimparFiltros.addEventListener('click', limparFiltros);
}

// Fechar modais
document.querySelectorAll('.modal-close, .modal-close-excluir, .btn-cancel, .btn-cancel-excluir').forEach(btn => {
    btn.addEventListener('click', () => {
        fecharModalPagamento();
        fecharModalExcluir();
    });
});

window.addEventListener('click', (e) => {
    if (e.target === modalPagamento) fecharModalPagamento();
    if (e.target === modalExcluir) fecharModalExcluir();
});

// Expor funções globalmente
window.editarPagamento = (id) => {
    const pagamento = pagamentos.find(p => p.id === id);
    if (pagamento) abrirModalPagamento(pagamento);
};

window.excluirPagamento = (id) => {
    abrirModalExcluir(id);
};

// Inicialização
carregarClientesEServicos();
carregarPagamentos();

// Autenticação
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'login.html';
    }
});

// Logout
const logoutBtn = document.getElementById('logout');
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        await signOut(auth);
        window.location.href = 'login.html';
    };
}