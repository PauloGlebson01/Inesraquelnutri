import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

let planosCache = [];
let produtosCache = [];
let resultadosCache = [];
let autenticado = false;

// Funções auxiliares
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
        'Avaliação': '📋',
        'Acompanhamento': '📈',
        'Esportiva': '🏃‍♀️',
        'Emagrecimento': '⚖️',
        'Gestantes': '🤰',
        'Infantil': '👶',
        'Vegetariana': '🥬',
        'Saúde': '❤️',
        'Suplementos': '💊',
        'Vitaminas': '💊',
        'Alimentos Funcionais': '🥑',
        'Ervas e Chás': '🌿',
        'Proteínas': '💪',
        'Fitoterápicos': '🌱'
    };
    return icons[categoria] || '🥗';
}

// ==================== PLANOS ====================
function abrirModalPlanos() {
    const modal = document.getElementById('servicosModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (autenticado) {
            carregarPlanos();
        }
    }
}

function fecharModalPlanos() {
    const modal = document.getElementById('servicosModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function abrirModalDetalhePlano(plano) {
    const modal = document.getElementById('servicoDetalheModal');
    if (!modal) return;
    
    document.getElementById('detalheServicoNome').textContent = plano.nome || 'Plano';
    document.getElementById('detalheServicoDuracao').textContent = formatarDuracao(plano.duracao);
    document.getElementById('detalheServicoCategoria').textContent = plano.categoria || 'Geral';
    document.getElementById('detalheServicoPreco').textContent = formatarMoeda(plano.preco || 0);
    document.getElementById('detalheServicoDescricao').textContent = plano.descricao || 'Sem descrição disponível.';
    
    const btnAgendar = document.getElementById('btnAgendarDetalhe');
    if (btnAgendar) {
        btnAgendar.href = `agendamento.html?servico=${encodeURIComponent(plano.nome)}&preco=${plano.preco}`;
    }
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function fecharModalDetalhePlano() {
    const modal = document.getElementById('servicoDetalheModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

async function carregarPlanos() {
    const planosLista = document.getElementById('servicosLista');
    if (!planosLista) return;
    
    console.log("Carregando planos...");
    
    try {
        const q = query(collection(db, "servicos"), orderBy("nome", "asc"));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            planosLista.innerHTML = `
                <div class="empty-servicos">
                    <i class="fa-solid fa-apple-whole"></i>
                    <p>Nenhum plano cadastrado ainda.</p>
                    <p style="font-size: 0.9rem; margin-top: 8px;">Em breve novos planos disponíveis!</p>
                </div>
            `;
            return;
        }
        
        planosCache = [];
        let planosHTML = '';
        
        querySnapshot.forEach(doc => {
            const plano = doc.data();
            plano.id = doc.id;
            planosCache.push(plano);
            
            const categoriaIcon = getCategoriaIcon(plano.categoria);
            
            planosHTML += `
                <div class="servico-card" data-index="${planosCache.length - 1}" data-tipo="plano">
                    <div class="servico-card-icon">
                        <i class="fa-solid fa-apple-whole"></i>
                    </div>
                    <div class="servico-card-info">
                        <h3>${escapeHtml(plano.nome || 'Sem nome')}</h3>
                        <div class="servico-card-meta">
                            <span class="servico-card-categoria">
                                ${categoriaIcon} ${escapeHtml(plano.categoria || 'Geral')}
                            </span>
                            <span class="servico-card-duracao">
                                <i class="fa-regular fa-clock"></i> ${formatarDuracao(plano.duracao)}
                            </span>
                        </div>
                        <div class="servico-card-preco">
                            ${formatarMoeda(plano.preco || 0)}
                        </div>
                        ${plano.descricao ? `
                            <p class="servico-card-descricao">${escapeHtml(plano.descricao.substring(0, 80))}${plano.descricao.length > 80 ? '...' : ''}</p>
                        ` : ''}
                    </div>
                    <div class="servico-card-action">
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>
                </div>
            `;
        });
        
        planosLista.innerHTML = planosHTML;
        
        document.querySelectorAll('.servico-card[data-tipo="plano"]').forEach(card => {
            card.addEventListener('click', (e) => {
                const index = card.getAttribute('data-index');
                if (index !== null && planosCache[index]) {
                    abrirModalDetalhePlano(planosCache[index]);
                }
            });
        });
        
    } catch (error) {
        console.error("Erro ao carregar planos:", error);
        planosLista.innerHTML = `
            <div class="empty-servicos">
                <i class="fa-solid fa-circle-exclamation"></i>
                <p>Erro ao carregar planos: ${error.message}</p>
                <button onclick="location.reload()" style="margin-top: 15px; padding: 8px 16px; background: #10b981; border: none; border-radius: 8px; color: white; cursor: pointer;">
                    <i class="fa-solid fa-rotate"></i> Tentar novamente
                </button>
            </div>
        `;
    }
}

// ==================== PRODUTOS ====================
function abrirModalProdutos() {
    const modal = document.getElementById('produtosModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (autenticado) {
            carregarProdutos();
        }
    }
}

function fecharModalProdutos() {
    const modal = document.getElementById('produtosModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function abrirModalDetalheProduto(produto) {
    const modal = document.getElementById('produtoDetalheModal');
    if (!modal) return;
    
    document.getElementById('detalheProdutoNome').textContent = produto.nome || 'Produto';
    document.getElementById('detalheProdutoCategoria').textContent = produto.categoria || 'Geral';
    document.getElementById('detalheProdutoPreco').textContent = formatarMoeda(produto.preco || 0);
    document.getElementById('detalheProdutoFornecedor').textContent = produto.fornecedor || 'Não informado';
    document.getElementById('detalheProdutoDescricao').textContent = produto.descricao || 'Sem descrição disponível.';
    
    const btnComprar = document.getElementById('btnComprarProduto');
    if (btnComprar && produto.linkCompra) {
        btnComprar.href = produto.linkCompra;
        btnComprar.style.display = 'flex';
    } else if (btnComprar) {
        btnComprar.style.display = 'none';
    }
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function fecharModalDetalheProduto() {
    const modal = document.getElementById('produtoDetalheModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

async function carregarProdutos() {
    const produtosLista = document.getElementById('produtosLista');
    if (!produtosLista) return;
    
    console.log("Carregando produtos...");
    
    try {
        const q = query(collection(db, "produtos"), orderBy("nome", "asc"));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            produtosLista.innerHTML = `
                <div class="empty-produtos">
                    <i class="fa-solid fa-box"></i>
                    <p>Nenhum produto cadastrado ainda.</p>
                    <p style="font-size: 0.9rem; margin-top: 8px;">Em breve novos produtos disponíveis!</p>
                </div>
            `;
            return;
        }
        
        produtosCache = [];
        let produtosHTML = '';
        
        querySnapshot.forEach(doc => {
            const produto = doc.data();
            produto.id = doc.id;
            produtosCache.push(produto);
            
            const categoriaIcon = getCategoriaIcon(produto.categoria);
            
            produtosHTML += `
                <div class="produto-card" data-index="${produtosCache.length - 1}" data-tipo="produto">
                    <div class="produto-card-icon">
                        <i class="fa-solid fa-box"></i>
                    </div>
                    <div class="produto-card-info">
                        <h3>${escapeHtml(produto.nome || 'Sem nome')}</h3>
                        <div class="produto-card-meta">
                            <span class="produto-card-categoria">
                                ${categoriaIcon} ${escapeHtml(produto.categoria || 'Geral')}
                            </span>
                        </div>
                        <div class="produto-card-preco">
                            ${formatarMoeda(produto.preco || 0)}
                        </div>
                        ${produto.descricao ? `
                            <p class="produto-card-descricao">${escapeHtml(produto.descricao.substring(0, 80))}${produto.descricao.length > 80 ? '...' : ''}</p>
                        ` : ''}
                    </div>
                    <div class="produto-card-action">
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>
                </div>
            `;
        });
        
        produtosLista.innerHTML = produtosHTML;
        
        document.querySelectorAll('.produto-card[data-tipo="produto"]').forEach(card => {
            card.addEventListener('click', (e) => {
                const index = card.getAttribute('data-index');
                if (index !== null && produtosCache[index]) {
                    abrirModalDetalheProduto(produtosCache[index]);
                }
            });
        });
        
    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
        produtosLista.innerHTML = `
            <div class="empty-produtos">
                <i class="fa-solid fa-circle-exclamation"></i>
                <p>Erro ao carregar produtos: ${error.message}</p>
                <button onclick="location.reload()" style="margin-top: 15px; padding: 8px 16px; background: #10b981; border: none; border-radius: 8px; color: white; cursor: pointer;">
                    <i class="fa-solid fa-rotate"></i> Tentar novamente
                </button>
            </div>
        `;
    }
}

// ==================== GALERIA DE RESULTADOS ====================
function abrirModalGaleria() {
    const modal = document.getElementById('galeriaModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        carregarResultados();
    }
}

function fecharModalGaleria() {
    const modal = document.getElementById('galeriaModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function abrirModalDetalheResultado(resultado) {
    const modal = document.getElementById('resultadoDetalheModal');
    if (!modal) return;
    
    document.getElementById('detalheResultadoTitulo').textContent = resultado.titulo || 'Resultado';
    document.getElementById('detalheResultadoDescricao').textContent = resultado.descricao || 'Sem descrição disponível.';
    document.getElementById('detalheResultadoPeriodo').textContent = resultado.periodo || 'Não informado';
    document.getElementById('detalheResultadoMeta').textContent = resultado.meta || 'Não informado';
    
    const imagem = document.getElementById('detalheResultadoImagem');
    if (imagem && resultado.imagemUrl) {
        imagem.src = resultado.imagemUrl;
        imagem.alt = resultado.titulo || 'Resultado';
    }
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function fecharModalDetalheResultado() {
    const modal = document.getElementById('resultadoDetalheModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

async function carregarResultados() {
    const galeriaLista = document.getElementById('galeriaLista');
    if (!galeriaLista) return;
    
    console.log("Carregando resultados...");
    
    try {
        const q = query(collection(db, "resultados"), orderBy("ordem", "asc"));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            galeriaLista.innerHTML = `
                <div class="empty-galeria">
                    <i class="fa-solid fa-images"></i>
                    <p>Nenhum resultado cadastrado ainda.</p>
                    <p style="font-size: 0.9rem; margin-top: 8px;">Em breve mais resultados disponíveis!</p>
                </div>
            `;
            return;
        }
        
        resultadosCache = [];
        let galeriaHTML = '';
        
        querySnapshot.forEach(doc => {
            const resultado = doc.data();
            resultado.id = doc.id;
            resultadosCache.push(resultado);
            
            galeriaHTML += `
                <div class="resultado-card" data-index="${resultadosCache.length - 1}" data-tipo="resultado">
                    <div class="resultado-imagem">
                        <img src="${escapeHtml(resultado.imagemUrl || './assets/placeholder.jpg')}" alt="${escapeHtml(resultado.titulo || 'Resultado')}">
                    </div>
                    <div class="resultado-info">
                        <h3>${escapeHtml(resultado.titulo || 'Resultado')}</h3>
                        <p class="resultado-descricao">${escapeHtml(resultado.descricao ? resultado.descricao.substring(0, 100) + (resultado.descricao.length > 100 ? '...' : '') : '')}</p>
                        <div class="resultado-meta">
                            <span class="resultado-periodo">
                                <i class="fa-regular fa-calendar"></i> ${escapeHtml(resultado.periodo || '-')}
                            </span>
                            <span class="resultado-meta-valor">
                                <i class="fa-solid fa-chart-line"></i> ${escapeHtml(resultado.meta || '-')}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        galeriaLista.innerHTML = galeriaHTML;
        
        document.querySelectorAll('.resultado-card[data-tipo="resultado"]').forEach(card => {
            card.addEventListener('click', (e) => {
                const index = card.getAttribute('data-index');
                if (index !== null && resultadosCache[index]) {
                    abrirModalDetalheResultado(resultadosCache[index]);
                }
            });
        });
        
    } catch (error) {
        console.error("Erro ao carregar resultados:", error);
        galeriaLista.innerHTML = `
            <div class="empty-galeria">
                <i class="fa-solid fa-circle-exclamation"></i>
                <p>Erro ao carregar resultados: ${error.message}</p>
                <button onclick="location.reload()" style="margin-top: 15px; padding: 8px 16px; background: #10b981; border: none; border-radius: 8px; color: white; cursor: pointer;">
                    <i class="fa-solid fa-rotate"></i> Tentar novamente
                </button>
            </div>
        `;
    }
}

// ==================== INICIALIZAÇÃO ====================
document.addEventListener("DOMContentLoaded", function () {
    // Elementos
    const themeToggle = document.getElementById("themeToggle");
    const shareBtn = document.getElementById("shareBtn");
    const shareModal = document.getElementById("shareModal");
    const closeShare = document.getElementById("closeShare");
    const copyLinkBtn = document.getElementById("copyLinkBtn");
    const shareLinkBtn = document.getElementById("shareLinkBtn");
    const planosBtn = document.getElementById("servicosBtn");
    const produtosBtn = document.getElementById("produtosBtn");
    const galeriaBtn = document.getElementById("galeriaBtn");
    
    // Fechar botões dos modais
    const modalClosePlanos = document.querySelector(".servicos-modal-close");
    const detalheClosePlanos = document.querySelector(".servico-detalhe-close");
    const modalCloseProdutos = document.querySelector(".produtos-modal-close");
    const detalheCloseProdutos = document.querySelector(".produto-detalhe-close");
    const modalCloseGaleria = document.querySelector(".galeria-modal-close");
    const detalheCloseResultado = document.querySelector(".resultado-detalhe-close");

    const currentUrl = window.location.href;

    // Autenticação Firebase
    signInAnonymously(auth).then(() => {
        console.log("Autenticado anonimamente com sucesso!");
        autenticado = true;
    }).catch((error) => {
        console.error("Erro na autenticação:", error);
        autenticado = false;
    });

    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("Usuário autenticado:", user.uid);
            autenticado = true;
        } else {
            console.log("Usuário não autenticado");
            autenticado = false;
        }
    });

    // Botão Planos
    if (planosBtn) {
        planosBtn.addEventListener("click", (e) => {
            e.preventDefault();
            abrirModalPlanos();
        });
    }

    // Botão Produtos
    if (produtosBtn) {
        produtosBtn.addEventListener("click", (e) => {
            e.preventDefault();
            abrirModalProdutos();
        });
    }

    // Botão Galeria
    if (galeriaBtn) {
        galeriaBtn.addEventListener("click", (e) => {
            e.preventDefault();
            abrirModalGaleria();
        });
    }

    // Fechar modais de Planos
    if (modalClosePlanos) modalClosePlanos.addEventListener("click", fecharModalPlanos);
    if (detalheClosePlanos) detalheClosePlanos.addEventListener("click", fecharModalDetalhePlano);

    // Fechar modais de Produtos
    if (modalCloseProdutos) modalCloseProdutos.addEventListener("click", fecharModalProdutos);
    if (detalheCloseProdutos) detalheCloseProdutos.addEventListener("click", fecharModalDetalheProduto);

    // Fechar modais de Galeria
    if (modalCloseGaleria) modalCloseGaleria.addEventListener("click", fecharModalGaleria);
    if (detalheCloseResultado) detalheCloseResultado.addEventListener("click", fecharModalDetalheResultado);

    // Fechar modais ao clicar fora
    window.addEventListener("click", (e) => {
        const planosModal = document.getElementById("servicosModal");
        const planoDetalheModal = document.getElementById("servicoDetalheModal");
        const produtosModal = document.getElementById("produtosModal");
        const produtoDetalheModal = document.getElementById("produtoDetalheModal");
        const galeriaModal = document.getElementById("galeriaModal");
        const resultadoDetalheModal = document.getElementById("resultadoDetalheModal");
        
        if (e.target === planosModal) fecharModalPlanos();
        if (e.target === planoDetalheModal) fecharModalDetalhePlano();
        if (e.target === produtosModal) fecharModalProdutos();
        if (e.target === produtoDetalheModal) fecharModalDetalheProduto();
        if (e.target === galeriaModal) fecharModalGaleria();
        if (e.target === resultadoDetalheModal) fecharModalDetalheResultado();
    });

    // Tema
    let savedTheme = localStorage.getItem("theme") || "dark";
    document.body.classList.add(savedTheme);
    updateThemeIcon();

    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            if (document.body.classList.contains("dark")) {
                document.body.classList.replace("dark", "light");
                localStorage.setItem("theme", "light");
            } else {
                document.body.classList.replace("light", "dark");
                localStorage.setItem("theme", "dark");
            }
            updateThemeIcon();
        });
    }

    function updateThemeIcon() {
        if (themeToggle) {
            themeToggle.textContent = document.body.classList.contains("dark") ? "🌙" : "☀️";
        }
    }

    // Modal de Compartilhamento
    if (shareBtn && shareModal && closeShare) {
        shareBtn.addEventListener("click", () => {
            shareModal.style.display = "flex";
            generateQRCode();
        });

        closeShare.addEventListener("click", () => {
            shareModal.style.display = "none";
        });

        window.addEventListener("click", (e) => {
            if (e.target === shareModal) shareModal.style.display = "none";
        });
    }

    function generateQRCode() {
        const qrContainer = document.getElementById("qrcode");
        if (!qrContainer) return;
        
        qrContainer.innerHTML = ""; 

        try {
            new QRCode(qrContainer, {
                text: "https://seudominio.com.br",
                width: 256,
                height: 256,
                colorDark: "#10b981",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        } catch (e) {
            console.error("Erro ao gerar QR Code:", e);
        }
    }

    // Ações de Compartilhamento
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(currentUrl);
                copyLinkBtn.textContent = "✅ Link copiado!";
                setTimeout(() => { copyLinkBtn.textContent = "📋 Copiar link"; }, 2000);
            } catch {
                alert("Erro ao copiar link");
            }
        });
    }

    if (shareLinkBtn) {
        shareLinkBtn.addEventListener("click", async () => {
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: "Inês Raquel - Nutricionista",
                        text: "Confira meu cartão digital! 🥗💚",
                        url: currentUrl
                    });
                } catch (err) {}
            } else {
                alert("Seu navegador não suporta compartilhamento direto.");
            }
        });
    }
});