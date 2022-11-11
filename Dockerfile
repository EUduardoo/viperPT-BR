FROM httpd:2.4

# Install needed dependencies
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y \
        apache2 \
        git \
        libcgi-pm-perl \
        libfile-flock-perl \
        libhtml-escape-perl \
        perl \ 
    && apt-get clean autoclean \
    && apt-get autoremove -y \
    && rm -rf /var/lib/{apt,dpkg,cache,log}/ \
    ;

# Adjust Apache configuration
RUN sed -E -i '\
        s/\#\s*(LoadModule .*mod_cgi)/\1/g; \
        s/^(\s*AllowOverride) None/\1 All\nSetEnv DEBUG 1/g; \
        s|/htdocs|/htdocs/www|g \
        ' conf/httpd.conf \
    && mkdir -p /usr/local/apache2/htdocs/www \
    ;

# docker build -t webscout-image .
# docker run -d -p 1073:80 --name webscout-container -v `pwd`:/usr/local/apache2/htdocs webscout-image
# Visit: http://localhost:1073/
# docker exec -it webscout-container bash
# docker logs webscout-container --follow
# docker container stop webscout-container
# docker container rm webscout-container