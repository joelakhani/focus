<div type="text/html" id="item_tmpl">
    <div id="<%=id%>" class="<%=(i % 2 == 1 ? " even" : "")%>">
        <div class="grid_1 alpha right">
            <img class="righted" src="<%=profile_image_url%>"/>
        </div>
        <div class="grid_6 omega contents">
            <p><b><a href="/<%=from_user%>"><%=from_user%></a>:</b> <%=text%></p>
        </div>
    </div>
</div>
<div type="text/html" id="user_tmpl">
    <% for ( var i = 0; i < users.length; i++ ) { %>
        <li><a href="<%=users[i].url%>"><%=users[i].name%></a></li>
    <% } %>
    <div class="outer">
    <% for ( var i = 0; i < users.length; i++ ) { %>
        <li><a href="<%=users[i].url%>"><%=users[i].name%></a></li>
    <% } %>
    </div>
</div>
