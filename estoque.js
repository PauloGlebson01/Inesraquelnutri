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

let produtos = [];
let unsubscribeProdutos = null;

// Elementos DOM
const estoqueGrid = document.getElementById('estoqueGrid');
const searchInput = document.getElementById('searchEstoque');
const filterCategoria = document.getElementById('filterCategoria');
const filterStatus = document.getElementById('filterStatus');
const btnLimparFiltros = document.getElementById('btnLimparFiltros');
const btnNovoProduto = document.getElementById('btnNovoProduto');
const btnMovimentacao = document.getElementById('btnMovimentacao');
const modalProduto = document.getElementById('modalProduto');
const modalMovimentacao = document.getElementById('modalMovimentacao');
const modalExcluir = document.getElementById('modalExcluir');
const modalHistorico = document.getElementById('modalHistorico');
const formProduto = document.getElementById('formProduto');
const formMovimentacao = document.getElementById('formMovimentacao');
const modalTitle = document.getElementById('modalTitle');
const produtoId = document.getElementById('produtoId');
const btnConfirmarExcluir = document.getElementById('confirmarExcluir');
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');

let produtoParaExcluir = null;
let produtoParaMovimentar = null;
let produtoParaHistorico = null;

// Função para obter ícone da categoria
function getCategoriaIcon(categoria) {
    const icons = {
        'Suplementos': '💊',
        'Vitaminas': '💊',
        'Alimentos Funcionais': '🥑',
        'Ervas e Chás': '🌿',
        'Proteínas': '💪',
        'Fitoterápicos': '🌱',
        'Higienização': '🧴',
        'Equipamentos': '⚖️'
    };
    return icons[categoria] || '🥗';
}

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
    if (isNaN(data.getTime())) return '-';
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getStatusEstoque(quantidade, minimo) {
    if (quantidade <= 0) return { status: 'esgotado', label: 'Esgotado', color: '#ef4444' };
    if (quantidade <= minimo) return { status: 'baixo', label: 'Estoque Baixo', color: '#f59e0b' };
    return { status: 'normal', label: 'Normal', color: '#10b981' };
}

function calcularPercentualEstoque(quantidade, minimo) {
    if (quantidade <= 0) return 0;
    const base = minimo * 2;
    const percent = (quantidade / base) * 100;
    return Math.min(percent, 100);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderizarEstoque() {
    if (!estoqueGrid) return;
    
    let filtered = [...produtos];
    
    const searchTerm = searchInput?.value.toLowerCase() || '';
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.nome?.toLowerCase().includes(searchTerm) ||
            p.categoria?.toLowerCase().includes(searchTerm) ||
            p.marca?.toLowerCase().includes(searchTerm) ||
            p.sku?.toLowerCase().includes(searchTerm)
        );
    }
    
    const categoria = filterCategoria?.value;
    if (categoria) {
        filtered = filtered.filter(p => p.categoria === categoria);
    }
    
    const statusFilter = filterStatus?.value;
    if (statusFilter) {
        filtered = filtered.filter(p => {
            const statusInfo = getStatusEstoque(p.quantidade || 0, p.minimo || 5);
            return statusInfo.status === statusFilter;
        });
    }
    
    if (filtered.length === 0) {
        estoqueGrid.innerHTML = `
            <div class="empty-estoque">
                <i class="fa-solid fa-box-open"></i>
                <p>Nenhum produto encontrado no estoque</p>
                <button class="btn-primary" onclick="document.getElementById('btnNovoProduto').click()">
                    <i class="fa-solid fa-plus"></i> Adicionar Produto
                </button>
            </div>
        `;
        return;
    }
    
    estoqueGrid.innerHTML = filtered.map(produto => {
        const statusInfo = getStatusEstoque(produto.quantidade || 0, produto.minimo || 5);
        const percentEstoque = calcularPercentualEstoque(produto.quantidade || 0, produto.minimo || 5);
        const categoriaIcon = getCategoriaIcon(produto.categoria);
        
        return `
            <div class="estoque-card" data-id="${produto.id}">
                <div class="estoque-header">
                    <div class="estoque-info">
                        <h3>${escapeHtml(produto.nome || 'Sem nome')}</h3>
                        <span class="estoque-categoria">${categoriaIcon} ${escapeHtml(produto.categoria || 'Sem categoria')}</span>
                    </div>
                    <div class="estoque-status ${statusInfo.status}" title="${statusInfo.label}"></div>
                </div>
                <div class="estoque-body">
                    <div class="estoque-detalhe">
                        <span class="label"><i class="fa-solid fa-barcode"></i> SKU:</span>
                        <span class="value">${escapeHtml(produto.sku || '-')}</span>
                    </div>
                    <div class="estoque-detalhe">
                        <span class="label"><i class="fa-solid fa-industry"></i> Marca/Fornecedor:</span>
                        <span class="value">${escapeHtml(produto.marca || '-')}</span>
                    </div>
                    <div class="estoque-preco">
                        <span class="preco-venda">${formatarMoeda(produto.preco || 0)}</span>
                        <span class="preco-custo">Custo: ${formatarMoeda(produto.custo || 0)}</span>
                    </div>
                    <div class="estoque-quantidade">
                        <i class="fa-solid fa-cubes"></i>
                        <span>Quantidade:</span>
                        <span class="quantidade-numero ${statusInfo.status === 'baixo' ? 'text-warning' : statusInfo.status === 'esgotado' ? 'text-danger' : ''}">
                            ${produto.quantidade || 0} un.
                        </span>
                        <div class="estoque-bar">
                            <div class="estoque-fill ${statusInfo.status}" style="width: ${percentEstoque}%"></div>
                        </div>
                    </div>
                    ${produto.descricao ? `
                        <div class="estoque-detalhe" style="margin-top: 12px;">
                            <span class="label"><i class="fa-solid fa-align-left"></i> Descrição:</span>
                            <span class="value" style="font-size: 0.75rem;">${escapeHtml(produto.descricao.substring(0, 60))}${produto.descricao.length > 60 ? '...' : ''}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="estoque-actions">
                    <button class="btn-movimentar" onclick="window.abrirMovimentacao('${produto.id}', '${escapeHtml(produto.nome).replace(/'/g, "\\'")}', ${produto.quantidade || 0})">
                        <i class="fa-solid fa-arrows-spin"></i> Movimentar
                    </button>
                    <button class="btn-historico" onclick="window.abrirHistorico('${produto.id}', '${escapeHtml(produto.nome).replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-clock-rotate-left"></i> Histórico
                    </button>
                    <button class="btn-edit-estoque" onclick="window.editarProduto('${produto.id}')">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-delete-estoque" onclick="window.excluirProduto('${produto.id}', '${escapeHtml(produto.nome).replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function atualizarEstatisticas() {
    const totalProdutos = produtos.length;
    const totalUnidades = produtos.reduce((sum, p) => sum + (p.quantidade || 0), 0);
    const estoqueBaixo = produtos.filter(p => {
        const qtd = p.quantidade || 0;
        const minimo = p.minimo || 5;
        return qtd > 0 && qtd <= minimo;
    }).length;
    const estoqueEsgotado = produtos.filter(p => (p.quantidade || 0) <= 0).length;
    const valorTotalEstoque = produtos.reduce((sum, p) => sum + ((p.custo || 0) * (p.quantidade || 0)), 0);
    
    const totalProdutosEl = document.getElementById('totalProdutos');
    const totalUnidadesEl = document.getElementById('totalUnidades');
    const estoqueBaixoEl = document.getElementById('estoqueBaixo');
    const estoqueEsgotadoEl = document.getElementById('estoqueEsgotado');
    const valorTotalEstoqueEl = document.getElementById('valorTotalEstoque');
    
    if (totalProdutosEl) totalProdutosEl.textContent = totalProdutos;
    if (totalUnidadesEl) totalUnidadesEl.textContent = totalUnidades;
    if (estoqueBaixoEl) estoqueBaixoEl.textContent = estoqueBaixo;
    if (estoqueEsgotadoEl) estoqueEsgotadoEl.textContent = estoqueEsgotado;
    if (valorTotalEstoqueEl) valorTotalEstoqueEl.textContent = formatarMoeda(valorTotalEstoque);
}

function carregarEstoque() {
    const q = query(collection(db, "produtos"), orderBy("nome", "asc"));
    
    unsubscribeProdutos = onSnapshot(q, (snapshot) => {
        produtos = [];
        snapshot.forEach(doc => {
            produtos.push({ id: doc.id, ...doc.data() });
        });
        renderizarEstoque();
        atualizarEstatisticas();
    }, (error) => {
        console.error("Erro ao carregar estoque:", error);
        if (estoqueGrid) {
            estoqueGrid.innerHTML = `
                <div class="empty-estoque">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <p>Erro ao carregar estoque: ${error.message}</p>
                </div>
            `;
        }
    });
}

// CRUD Produtos
async function salvarProduto(dados) {
    try {
        if (dados.id) {
            const docRef = doc(db, "produtos", dados.id);
            await updateDoc(docRef, {
                nome: dados.nome,
                categoria: dados.categoria,
                sku: dados.sku,
                marca: dados.marca,
                quantidade: Number(dados.quantidade),
                custo: Number(dados.custo),
                preco: Number(dados.preco),
                descricao: dados.descricao,
                minimo: Number(dados.minimo),
                atualizadoEm: Timestamp.now()
            });
            mostrarToast("Produto atualizado com sucesso!");
        } else {
            await addDoc(collection(db, "produtos"), {
                nome: dados.nome,
                categoria: dados.categoria,
                sku: dados.sku,
                marca: dados.marca,
                quantidade: Number(dados.quantidade),
                custo: Number(dados.custo),
                preco: Number(dados.preco),
                descricao: dados.descricao,
                minimo: Number(dados.minimo),
                createdAt: Timestamp.now(),
                atualizadoEm: Timestamp.now()
            });
            mostrarToast("Produto adicionado com sucesso!");
        }
        fecharModalProduto();
    } catch (error) {
        console.error("Erro ao salvar produto:", error);
        mostrarToast("Erro ao salvar produto.", "erro");
    }
}

async function deletarProduto(id) {
    try {
        await deleteDoc(doc(db, "produtos", id));
        mostrarToast("Produto excluído com sucesso!");
        fecharModalExcluir();
    } catch (error) {
        console.error("Erro ao excluir produto:", error);
        mostrarToast("Erro ao excluir produto.", "erro");
    }
}

// Movimentação de Estoque
async function registrarMovimentacao(produtoId, tipo, quantidade, observacao) {
    try {
        const produto = produtos.find(p => p.id === produtoId);
        if (!produto) {
            mostrarToast("Produto não encontrado.", "erro");
            return false;
        }
        
        let novaQuantidade = produto.quantidade || 0;
        
        if (tipo === 'entrada') {
            novaQuantidade += quantidade;
        } else if (tipo === 'saida') {
            if (novaQuantidade < quantidade) {
                mostrarToast(`Estoque insuficiente! Disponível: ${novaQuantidade} unidade(s).`, "erro");
                return false;
            }
            novaQuantidade -= quantidade;
        }
        
        const produtoRef = doc(db, "produtos", produtoId);
        await updateDoc(produtoRef, {
            quantidade: novaQuantidade,
            atualizadoEm: Timestamp.now()
        });
        
        await addDoc(collection(db, "movimentacoes"), {
            produtoId: produtoId,
            produtoNome: produto.nome,
            tipo: tipo,
            quantidade: quantidade,
            quantidadeAnterior: produto.quantidade || 0,
            quantidadeNova: novaQuantidade,
            observacao: observacao || '',
            data: Timestamp.now(),
            usuario: "Nutricionista"
        });
        
        const tipoTexto = tipo === 'entrada' ? 'entrada' : 'saída';
        mostrarToast(`${quantidade} unidade(s) registradas como ${tipoTexto} com sucesso!`);
        return true;
        
    } catch (error) {
        console.error("Erro ao registrar movimentação:", error);
        mostrarToast("Erro ao registrar movimentação.", "erro");
        return false;
    }
}

// Função corrigida para carregar histórico - SEM ORDER BY
async function carregarHistorico(produtoId) {
    const historicoLista = document.getElementById('historicoLista');
    if (!historicoLista) return;
    
    historicoLista.innerHTML = '<div class="loading-historico"><i class="fa-solid fa-spinner fa-spin"></i> Carregando histórico...</div>';
    
    try {
        console.log("Buscando movimentações para o produto:", produtoId);
        
        const q = query(
            collection(db, "movimentacoes"),
            where("produtoId", "==", produtoId)
        );
        
        const snapshot = await getDocs(q);
        
        console.log("Movimentações encontradas:", snapshot.size);
        
        if (snapshot.empty) {
            historicoLista.innerHTML = `
                <div class="empty-estoque" style="padding: 40px;">
                    <i class="fa-solid fa-clock-rotate-left"></i>
                    <p>Nenhuma movimentação registrada para este produto.</p>
                    <p style="font-size: 0.8rem; margin-top: 8px;">Clique em "Movimentar" para registrar entradas ou saídas.</p>
                </div>
            `;
            return;
        }
        
        const movimentacoes = [];
        snapshot.forEach(doc => {
            const mov = doc.data();
            mov.id = doc.id;
            movimentacoes.push(mov);
        });
        
        movimentacoes.sort((a, b) => {
            const dataA = a.data?.toDate ? a.data.toDate() : new Date(a.data);
            const dataB = b.data?.toDate ? b.data.toDate() : new Date(b.data);
            return dataB - dataA;
        });
        
        historicoLista.innerHTML = '';
        
        movimentacoes.forEach(mov => {
            const isEntrada = mov.tipo === 'entrada';
            
            const item = document.createElement('div');
            item.className = `movimentacao-item ${mov.tipo}`;
            item.innerHTML = `
                <div class="movimentacao-header">
                    <span class="movimentacao-tipo ${mov.tipo}">
                        <i class="fa-solid ${isEntrada ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                        ${isEntrada ? 'ENTRADA' : 'SAÍDA'}
                    </span>
                    <span class="movimentacao-data">${formatarData(mov.data)}</span>
                </div>
                <div class="movimentacao-quantidade ${mov.tipo}">
                    ${isEntrada ? '+' : '-'} ${mov.quantidade} unidade(s)
                </div>
                <div class="movimentacao-detalhes">
                    <small>Estoque anterior: ${mov.quantidadeAnterior} un.</small>
                    <small style="margin-left: 12px;">Estoque atual: ${mov.quantidadeNova} un.</small>
                </div>
                ${mov.observacao ? `<div class="movimentacao-obs"><i class="fa-solid fa-comment"></i> ${escapeHtml(mov.observacao)}</div>` : ''}
            `;
            historicoLista.appendChild(item);
        });
        
        const historicoSearch = document.getElementById('historicoSearch');
        if (historicoSearch) {
            const newSearch = historicoSearch.cloneNode(true);
            historicoSearch.parentNode.replaceChild(newSearch, historicoSearch);
            
            newSearch.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const items = historicoLista.querySelectorAll('.movimentacao-item');
                items.forEach(item => {
                    const text = item.textContent.toLowerCase();
                    item.style.display = text.includes(term) ? 'block' : 'none';
                });
            });
        }
        
    } catch (error) {
        console.error("Erro ao carregar histórico:", error);
        historicoLista.innerHTML = `
            <div class="empty-estoque" style="padding: 40px;">
                <i class="fa-solid fa-circle-exclamation"></i>
                <p>Erro ao carregar histórico: ${error.message}</p>
                <p style="font-size: 0.8rem; margin-top: 8px;">Verifique sua conexão com a internet.</p>
                <button onclick="window.carregarHistorico('${produtoId}')" style="margin-top: 15px; padding: 8px 16px; background: #10b981; border: none; border-radius: 8px; color: white; cursor: pointer;">
                    <i class="fa-solid fa-rotate"></i> Tentar novamente
                </button>
            </div>
        `;
    }
}

// Modal Functions
function abrirModalProduto(produto = null) {
    if (produto) {
        modalTitle.innerHTML = '<i class="fa-solid fa-pen"></i> Editar Produto';
        produtoId.value = produto.id;
        document.getElementById('produtoNome').value = produto.nome || '';
        document.getElementById('produtoCategoria').value = produto.categoria || '';
        document.getElementById('produtoSku').value = produto.sku || '';
        document.getElementById('produtoMarca').value = produto.marca || '';
        document.getElementById('produtoQuantidade').value = produto.quantidade || 0;
        document.getElementById('produtoCusto').value = produto.custo || 0;
        document.getElementById('produtoPreco').value = produto.preco || 0;
        document.getElementById('produtoDescricao').value = produto.descricao || '';
        document.getElementById('produtoMinimo').value = produto.minimo || 5;
    } else {
        modalTitle.innerHTML = '<i class="fa-solid fa-plus"></i> Novo Produto';
        produtoId.value = '';
        formProduto.reset();
        document.getElementById('produtoMinimo').value = 5;
        document.getElementById('produtoQuantidade').value = 0;
    }
    modalProduto.classList.add('active');
}

function fecharModalProduto() {
    modalProduto.classList.remove('active');
}

function abrirMovimentacao(id, nome, quantidadeAtual) {
    produtoParaMovimentar = id;
    document.getElementById('movProdutoId').value = id;
    document.getElementById('movProdutoNome').value = nome;
    document.getElementById('movEstoqueAtual').value = `${quantidadeAtual} unidade(s)`;
    document.getElementById('movQuantidade').value = '';
    document.getElementById('movObservacao').value = '';
    document.getElementById('movTipo').value = 'entrada';
    modalMovimentacao.classList.add('active');
}

function fecharModalMovimentacao() {
    modalMovimentacao.classList.remove('active');
    produtoParaMovimentar = null;
}

function abrirHistorico(id, nome) {
    produtoParaHistorico = id;
    const modalHeader = document.querySelector('#modalHistorico .modal-header h2');
    if (modalHeader) {
        modalHeader.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> Histórico - ${escapeHtml(nome)}`;
    }
    carregarHistorico(id);
    modalHistorico.classList.add('active');
}

function fecharModalHistorico() {
    modalHistorico.classList.remove('active');
    produtoParaHistorico = null;
}

function abrirModalExcluir(id, nome) {
    produtoParaExcluir = id;
    document.getElementById('excluirNome').textContent = nome;
    modalExcluir.classList.add('active');
}

function fecharModalExcluir() {
    modalExcluir.classList.remove('active');
    produtoParaExcluir = null;
}

// Event Listeners
if (formProduto) {
    formProduto.addEventListener('submit', (e) => {
        e.preventDefault();
        const dados = {
            id: produtoId.value,
            nome: document.getElementById('produtoNome').value,
            categoria: document.getElementById('produtoCategoria').value,
            sku: document.getElementById('produtoSku').value,
            marca: document.getElementById('produtoMarca').value,
            quantidade: document.getElementById('produtoQuantidade').value,
            custo: document.getElementById('produtoCusto').value,
            preco: document.getElementById('produtoPreco').value,
            descricao: document.getElementById('produtoDescricao').value,
            minimo: document.getElementById('produtoMinimo').value
        };
        salvarProduto(dados);
    });
}

if (formMovimentacao) {
    formMovimentacao.addEventListener('submit', async (e) => {
        e.preventDefault();
        const produtoId = document.getElementById('movProdutoId').value;
        const tipo = document.getElementById('movTipo').value;
        const quantidade = parseInt(document.getElementById('movQuantidade').value);
        const observacao = document.getElementById('movObservacao').value;
        
        if (!quantidade || quantidade <= 0) {
            mostrarToast("Informe uma quantidade válida.", "erro");
            return;
        }
        
        await registrarMovimentacao(produtoId, tipo, quantidade, observacao);
        fecharModalMovimentacao();
    });
}

if (btnNovoProduto) {
    btnNovoProduto.addEventListener('click', () => abrirModalProduto());
}

if (btnMovimentacao) {
    btnMovimentacao.addEventListener('click', () => {
        mostrarToast("Selecione um produto para movimentar.", "erro");
    });
}

if (btnConfirmarExcluir) {
    btnConfirmarExcluir.addEventListener('click', () => {
        if (produtoParaExcluir) deletarProduto(produtoParaExcluir);
    });
}

if (btnLimparFiltros) {
    btnLimparFiltros.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (filterCategoria) filterCategoria.value = '';
        if (filterStatus) filterStatus.value = '';
        renderizarEstoque();
    });
}

if (searchInput) searchInput.addEventListener('input', renderizarEstoque);
if (filterCategoria) filterCategoria.addEventListener('change', renderizarEstoque);
if (filterStatus) filterStatus.addEventListener('change', renderizarEstoque);

// Fechar modais
document.querySelectorAll('.modal-close, .modal-close-mov, .modal-close-excluir, .modal-close-historico, .btn-cancel, .btn-cancel-mov, .btn-cancel-excluir').forEach(btn => {
    btn.addEventListener('click', () => {
        fecharModalProduto();
        fecharModalMovimentacao();
        fecharModalExcluir();
        fecharModalHistorico();
    });
});

window.addEventListener('click', (e) => {
    if (e.target === modalProduto) fecharModalProduto();
    if (e.target === modalMovimentacao) fecharModalMovimentacao();
    if (e.target === modalExcluir) fecharModalExcluir();
    if (e.target === modalHistorico) fecharModalHistorico();
});

// Expor funções globalmente
window.editarProduto = (id) => {
    const produto = produtos.find(p => p.id === id);
    if (produto) abrirModalProduto(produto);
};

window.excluirProduto = (id, nome) => {
    abrirModalExcluir(id, nome);
};

window.abrirMovimentacao = (id, nome, quantidade) => {
    abrirMovimentacao(id, nome, quantidade);
};

window.abrirHistorico = (id, nome) => {
    abrirHistorico(id, nome);
};

window.carregarHistorico = carregarHistorico;

// Autenticação
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Usuário autenticado:", user.email);
        carregarEstoque();
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