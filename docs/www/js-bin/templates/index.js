<!DOCTYPE html>
<html lang="en">
<head>
    <link rel="stylesheet" type="text/css" href="/css/index.css">
    <meta charset="UTF-8">
    <title>Focus Framework - Examples</title>
</head>
<body>
    <div class="page">
        <div id="header" class="" style="display: block; top: 0;">
            <div class="inner" style="padding-top: 20px;">
                It Works! If you're seeing this page it means you are running Focus Framework Scripts.
            </div>
        </div>
        <div class="clear"></div>
        <div class="home" style="margin-top: 60px; display: block;">
            <div class="container" style="display: block">
                <div class="row">
                    <div class="left">
                        <div class="well">
                            <%= content %>
                        </div>
                    </div>
                    <div class="right">
                        <nav class="bs-docs-sidebar">
                            <ul class="nav bs-docs-sidenav">
                                <li><a href="/test">Examples Home</a></li>
                                <li><a href="/test/redirect">Redirect</a></li>
                                <li><a href="/test/session">Session</a></li>
                                <li><a href="/test/upload">Upload File</a></li>
                                <li><a href="/test/sendfile">Download File</a></li>
                                <li><a href="/test/cleaninput">Clean Input</a></li>
                                <li><a href="/test/rendering">Rendering</a></li>
                                <li><a href="/test/cookies">Cookies</a></li>
                                <li><a href="/test/validator">Validator</a></li>
                                <li><a href="/test/reqstore">Request Storage</a></li>
                                <li><a href="/test/logging">Logging</a></li>
                                <li><a href="/test/badfile">Error Handling - Output goes to console</a></li>
                            </ul>
                        </nav>
                    </div>
                </div>
            </div>
        </div>
        <div class="clear"></div>
        <div id="BottomFrame">
            <div id="BottomBar">
                <footer>
                    <div class="copyright" style="font-size: 14px;">
                        <span>
                            <span class="muted">&copy;</span>
                            2015 <b>Joe Lakhani</b>
                            &nbsp; | &nbsp; Focus Framework
                        </span>
                    </div>
                </footer>
            </div>
        </div>
    </div>
</body>
</html>
