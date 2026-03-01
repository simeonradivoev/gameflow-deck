cmake_minimum_required(VERSION 3.16)

project(SimpleWebView LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Required for Qt WebEngine
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

find_package(Qt6 REQUIRED COMPONENTS
    Core
    Widgets
    WebEngineWidgets,
    Gamepad
)

add_executable(webview
    main.cpp
)

target_link_libraries(webview PRIVATE
    Qt6::Core
    Qt6::Widgets
    Qt6::WebEngineWidgets,
    Qt6::Gamepad
)


# Install binary into Flatpak prefix (/app)
install(TARGETS webview
    RUNTIME DESTINATION bin
)