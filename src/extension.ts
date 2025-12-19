import * as vscode from 'vscode';

// --- Partie 1 : Le bouton dans la barre latérale ---
class CasinoTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
		if (!element) {
			// Le bouton sur lequel on clique dans la barre latérale
			const openItem = new vscode.TreeItem("🎰 Entrer dans le Casino", vscode.TreeItemCollapsibleState.None);
			openItem.iconPath = new vscode.ThemeIcon('play-circle');
			openItem.command = {
				command: 'gambling-corner.openCasino', // DOIT correspondre au package.json
				title: 'Ouvrir',
				arguments: []
			};
			return Promise.resolve([openItem]);
		}
		return Promise.resolve([]);
	}
}

// --- Partie 2 : Activation de l'extension ---
export function activate(context: vscode.ExtensionContext) {
	// 1. On lie le code à la vue déclarée dans package.json
	vscode.window.registerTreeDataProvider('gamblingCornerView', new CasinoTreeDataProvider());

	// 2. On enregistre la commande qui ouvre l'onglet
	let disposable = vscode.commands.registerCommand('gambling-corner.openCasino', () => {
		CasinoPanel.createOrShow(context.extensionUri);
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}

// --- Partie 3 : La fenêtre du Casino (WebView) ---
class CasinoPanel {
	public static currentPanel: CasinoPanel | undefined;
	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	public static createOrShow(extensionUri: vscode.Uri) {
		const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

		// Si le panneau existe déjà, on le montre juste
		if (CasinoPanel.currentPanel) {
			CasinoPanel.currentPanel._panel.reveal(column);
			return;
		}

		// Sinon, on crée un nouveau panneau
		const panel = vscode.window.createWebviewPanel(
			'gamblingCasino',
			'🎰 Gambling Corner',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
			}
		);

		CasinoPanel.currentPanel = new CasinoPanel(panel, extensionUri);
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;
		this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
	}

	public dispose() {
		CasinoPanel.currentPanel = undefined;
		this._panel.dispose();	
		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) { x.dispose(); }
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Récupération des images depuis le dossier media
		const getImg = (name: string) => webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', name));
		
		// ATTENTION : Assurez-vous que ces fichiers existent dans votre dossier 'media'
		const img1 = getImg('f1.jpg');
		const img2 = getImg('f2.jpg');
		const img3 = getImg('f3.jpg');

		// Tableau des images pour le JS
		const imagesList = JSON.stringify([img1.toString(), img2.toString(), img3.toString()]);

		return `<!DOCTYPE html>
		<html lang="fr">
		<head>
			<meta charset="UTF-8">
			<style>
				body {
					background-color: var(--vscode-editor-background);
					color: var(--vscode-editor-foreground);
					display: flex; flex-direction: column; align-items: center; justify-content: center;
					height: 95vh; font-family: 'Segoe UI', sans-serif;
				}
				h1 { text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px; font-size: 1.5em; }
				
				/* Les Rouleaux */
				.slots-box {
					background: #2d2d2d; padding: 15px; border-radius: 10px;
					display: flex; gap: 10px; border: 4px solid #d4af37;
					box-shadow: 0 0 20px rgba(0,0,0,0.5); margin-bottom: 30px;
				}
				.reel {
					width: 80px; height: 80px; background: white;
					border-radius: 5px; overflow: hidden; display: flex; align-items: center; justify-content: center;
					box-shadow: inset 0 0 10px rgba(0,0,0,0.8);
				}
				.reel img { width: 90%; height: 90%; object-fit: contain; }
				
				/* Effet flou */
				.blur { animation: blurAnim 0.1s infinite; }
				@keyframes blurAnim { 0% { filter: blur(2px); transform: translateY(-2px); } 100% { filter: blur(2px); transform: translateY(2px); } }

				/* LE GROS BOUTON ROUGE */
				#spinBtn {
					width: 120px; height: 120px; border-radius: 50%; border: none; cursor: pointer;
					background: radial-gradient(circle at 30% 30%, #ff5e5e, #c00000);
					box-shadow: 0 8px 0 #800000, 0 15px 20px rgba(0,0,0,0.4);
					font-weight: bold; color: white; font-size: 1.2em; text-shadow: 0 2px 2px rgba(0,0,0,0.3);
					transition: all 0.1s;
				}
				#spinBtn:active {
					transform: translateY(8px); box-shadow: 0 0 0 #800000, inset 0 0 10px rgba(0,0,0,0.5);
				}
				#spinBtn:disabled { filter: grayscale(0.8); cursor: not-allowed; }

				#status { margin-top: 25px; font-size: 1.2em; height: 30px; font-weight: bold;}
			</style>
		</head>
		<body>
			<h1>Gambling Corner</h1>
			<div class="slots-box">
				<div class="reel"><img id="r1" src="${img1}"></div>
				<div class="reel"><img id="r2" src="${img1}"></div>
				<div class="reel"><img id="r3" src="${img1}"></div>
			</div>

			<button id="spinBtn">SPIN</button>
			<div id="status">Tentez votre chance !</div>

			<script>
				const images = ${imagesList};
				const reels = [document.getElementById('r1'), document.getElementById('r2'), document.getElementById('r3')];
				const btn = document.getElementById('spinBtn');
				const status = document.getElementById('status');
				let intervals = [null, null, null];

				btn.addEventListener('click', () => {
					if(btn.disabled) return;
					start();
				});

				function start() {
					btn.disabled = true;
					status.innerText = "La roue tourne...";
					status.style.color = "inherit";

					// Lancer les 3 rouleaux
					reels.forEach((r, i) => {
						r.classList.add('blur');
						intervals[i] = setInterval(() => {
							r.src = images[Math.floor(Math.random() * images.length)];
						}, 100);
					});

					// Arrêt progressif
					setTimeout(() => stop(0), 1500);
					setTimeout(() => stop(1), 2200);
					setTimeout(() => stop(2), 3000);
				}

				let results = [];
				function stop(index) {
					clearInterval(intervals[index]);
					reels[index].classList.remove('blur');
					
					// Choix final
					const finalIndex = Math.floor(Math.random() * images.length);
					reels[index].src = images[finalIndex];
					results[index] = finalIndex;

					if(index === 2) checkWin();
				}

				function checkWin() {
					btn.disabled = false;
					if(results[0] === results[1] && results[1] === results[2]) {
						status.innerHTML = "✨ JACKPOT ! ✨";
						status.style.color = "#FFD700";
					} else {
						status.innerText = "Perdu... Réessayez !";
					}
					results = [];
				}
			</script>
		</body>
		</html>`;
	}
}