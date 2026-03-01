#include <QApplication> 
#include <QWebEngineView> 
#include <QWebEngineSettings>
#include <QUrl>

int main(int argc, char *argv[]) 
{ 
    QApplication app(argc, argv); 
    if (argc < 2) { return 1; } 
    QWebEngineView view; 
    view.setUrl(QUrl(argv[1])); 
    view.showFullScreen(); 
    return app.exec(); 
}